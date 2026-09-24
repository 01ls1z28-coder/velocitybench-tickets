# Tickets · VelocityBench Hub

Shared helpdesk board for VelocityBench.

- **Frontend:** static SPA, Hub brass/dark chrome, deployed on **GitHub Pages** from this repository.
- **Backend:** **Supabase cloud** (Auth + Postgres). Email/password sign-up and sign-in. Ticket and comment data live in **your Supabase project** — not a local-only / PC-must-be-on store.
- **Credits:** Jorge Guerra.

## Quick start (local)

1. Create a free [Supabase](https://supabase.com) project.
2. Run `supabase/migrations/001_tickets_v1.sql` in the SQL editor.
3. Copy `config.example.js` → `config.js` and set `supabaseUrl` + `supabaseAnonKey` (**anon/public key only** — never `service role secret`).
4. Serve the repo root over HTTP (any static server) and open the app.
5. Sign up with email, password, and display name. Optionally click **Demo seed** to insert sample tickets for your account.

Without `config.js`, the app shows a configure banner. You can open **Demo preview (UI only)** for an in-memory layout mock — clearly labeled, not fake auth.

## GitHub Pages

Enable Pages on this repo (deploy from branch / docs or Actions as you prefer). Ensure a build or commit step provides `config.js` with your cloud Supabase URL and **anon** key (or inject `window.VB_TICKETS_CONFIG` before `js/app.js`). Do not put the service role key in Pages, the repo, or the client bundle.

## Docs

- [HOW-TO.md](./HOW-TO.md) — Supabase setup, RLS checklist, seed, Pages config
- [VERIFY.md](./VERIFY.md) — must-ship checklist for this tip
- [supabase/seed.sql](./supabase/seed.sql) — optional SQL seed notes

## Out of scope (v1)

Email inbound, customer portal, SLA bots, attachments, Hub card on forcemetric-web (follow-up tip after CLEAR), multi-tenant workspaces, migrating off Supabase to a dedicated server.
