-- VelocityBench Tickets v1 — schema + RLS
-- Run in Supabase SQL editor (or via supabase db push).
-- Requires: auth schema (managed by Supabase).

create extension if not exists "pgcrypto";

-- ── profiles ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- ── tickets ───────────────────────────────────────────────
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'blocked', 'done')),
  priority text not null default 'med'
    check (priority in ('low', 'med', 'high', 'urgent')),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_priority_idx on public.tickets (priority);
create index if not exists tickets_due_at_idx on public.tickets (due_at);
create index if not exists tickets_assignee_id_idx on public.tickets (assignee_id);

-- ── comments (append-only) ────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_ticket_id_idx on public.comments (ticket_id);

-- ── updated_at trigger ────────────────────────────────────
create or replace function public.set_tickets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_tickets_updated_at();

-- ── auto-create profile on sign-up ────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dn text;
begin
  dn := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    split_part(new.email, '@', 1),
    'user'
  );
  insert into public.profiles (id, display_name)
  values (new.id, dn)
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.comments enable row level security;

-- profiles: authenticated can read all (assignee picker); update own
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- tickets: shared workspace — any authenticated user full CRUD
drop policy if exists "tickets_select_authenticated" on public.tickets;
create policy "tickets_select_authenticated"
  on public.tickets for select
  to authenticated
  using (true);

drop policy if exists "tickets_insert_authenticated" on public.tickets;
create policy "tickets_insert_authenticated"
  on public.tickets for insert
  to authenticated
  with check (true);

drop policy if exists "tickets_update_authenticated" on public.tickets;
create policy "tickets_update_authenticated"
  on public.tickets for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "tickets_delete_authenticated" on public.tickets;
create policy "tickets_delete_authenticated"
  on public.tickets for delete
  to authenticated
  using (true);

-- comments: append-only (SELECT + INSERT); no UPDATE/DELETE
drop policy if exists "comments_select_authenticated" on public.comments;
create policy "comments_select_authenticated"
  on public.comments for select
  to authenticated
  using (true);

drop policy if exists "comments_insert_authenticated" on public.comments;
create policy "comments_insert_authenticated"
  on public.comments for insert
  to authenticated
  with check (true);

-- Deny anon explicitly (RLS with no anon policies = no access)
-- No policies for role `anon` on these tables.
