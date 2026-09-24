# VERIFY — Tickets v1 (Tip A)

Repo: `https://github.com/01ls1z28-coder/velocitybench-tickets`  
Branch: `review/tickets-v1`

## Architecture honesty

- [x] Auth/DB = **Supabase cloud** (not “only when PC is on”)
- [x] Frontend deploy target = **GitHub Pages** on this repo
- [x] Footer/README state tickets live in **your Supabase project**
- [x] Hub card on forcemetric-web = **Tip B after CLEAR** (not edited in this tip)
- [x] No migrate-to-dedicated-server work in v1

## Must-ship

- [x] Auth: sign in, sign up (display_name required), sign out, session restore
- [x] Ticket CRUD: title, description, status, priority, assignee, due, tags, fleet custom_fields
- [x] Kanban by status + Table; search; status/priority chips; due horizons
- [x] Detail drawer: edit + append-only comments (author display_name + timestamp)
- [x] CSV export of filtered view (client-side)
- [x] Empty states + `supabase/seed.sql` + in-app Demo seed (anon+RLS)
- [x] Mobile-friendly; header primary actions (no hamburger)
- [x] README + HOW-TO + VERIFY; `config.example.js`; configure banner when placeholders
- [x] Demo preview mode labeled “not your database” — no fake client passwords

## Security

- [x] Only anon key in frontend config pattern
- [x] `rg` clean for `service role secret` in shipped paths
- [x] RLS SQL in `supabase/migrations/001_tickets_v1.sql`
- [x] No anonymous access policies on tickets/comments/profiles

## Credits

- [x] Jorge Guerra only in UI/README/public text
- [x] No internal builder product names in shipped HTML/CSS/JS/README

## Tip B (not this tip)

After Tip A CLEAR / LIVE: add Hub card on forcemetric-web pointing at the Pages URL.

## Tip SHA

`0a5614ea516a8e836fbe9195ad6f933b7e7cfd93` on `review/tickets-v1`
