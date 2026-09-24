# HOW-TO — Tickets · VelocityBench Hub

## 1. Supabase cloud project

1. Create a project at https://supabase.com (free tier is fine).
2. Open **Project Settings → API**.
3. Copy:
   - **Project URL** → `supabaseUrl`
   - **anon public** key → `supabaseAnonKey`
4. Never copy the **service role secret** key into this app, GitHub Pages, or git.

Local PC is only for development/testing the static files. Auth and ticket rows live in **Supabase cloud**, so the board works when your PC is offline as long as Pages + Supabase are up.

## 2. Schema + RLS

In the Supabase **SQL Editor**, run the full contents of:

`supabase/migrations/001_tickets_v1.sql`

That creates `profiles`, `tickets`, `comments`, indexes, the sign-up → profile trigger, and RLS:

| Table     | Authenticated | Anon |
|-----------|---------------|------|
| profiles  | SELECT all; INSERT/UPDATE own | none |
| tickets   | SELECT/INSERT/UPDATE/DELETE (shared workspace) | none |
| comments  | SELECT/INSERT only (append-only) | none |

### RLS checklist

- [ ] RLS enabled on `profiles`, `tickets`, `comments`
- [ ] No policies granting `anon` access to those tables
- [ ] Sign up creates a `profiles` row (trigger on `auth.users`)
- [ ] Second signed-in user can see tickets created by the first (shared workspace)

Optional Auth setting for faster local testing: **Authentication → Providers → Email →** disable “Confirm email” (re-enable for production if you want).

## 3. Local `config.js`

```bash
cp config.example.js config.js
# edit config.js — fill supabaseUrl and supabaseAnonKey
```

`config.js` is gitignored. Serve the repo root:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## 4. GitHub Pages

1. Settings → Pages → deploy from the branch that contains `index.html` (often `main` after merge, or `gh-pages`).
2. Provide `config.js` on the deployed site **without committing secrets to a public fork workflow you do not control**. Options:
   - Private inject at deploy time (CI writes `config.js` from repository secrets `SUPABASE_URL` + `SUPABASE_ANON_KEY`)
   - Or a one-time commit of `config.js` containing **only** the anon key (anon is designed for browsers; still pair with RLS)
3. Confirm the live page never contains `service role secret`.

Site URL pattern: `https://01ls1z28-coder.github.io/velocitybench-tickets/` (or custom domain).

## 5. Seed data

**Preferred:** sign in → **Demo seed** header button. Inserts a few tickets as the signed-in user via the anon client + RLS (no service role).

**Optional SQL:** see `supabase/seed.sql`. You must substitute a real `profiles.id` after first sign-up.

## 6. Demo preview without Supabase

If placeholders remain, use **Demo preview (UI only — not your database)** or `?demo=1`. This paints sample cards in memory and is labeled in the UI. It is **not** fake password auth.

## 7. Hub card

The Hub card on forcemetric-web is a **follow-up tip after this app is CLEAR** — not part of this tip’s ship.
