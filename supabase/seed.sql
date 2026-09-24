-- Example seed — run AFTER you have signed up at least once.
-- Replace :user_id with your auth.users / profiles.id (uuid).
--
-- Example:
--   select id, display_name from public.profiles;
--   -- then paste that uuid below.

-- \set user_id '00000000-0000-0000-0000-000000000000'

-- Prefer the in-app "Load demo tickets" button (client insert via anon+RLS).
-- Or uncomment and run after setting user_id:

/*
insert into public.tickets (title, description, status, priority, assignee_id, due_at, tags, custom_fields, created_by)
values
  (
    'Replace brake pads — Unit 12',
    'Front pads worn; schedule bay time.',
    'open',
    'high',
    :'user_id'::uuid,
    now() + interval '3 days',
    array['fleet','maintenance'],
    '{"unit_number":"12","vehicle":"F-250","driver":"M. Reyes"}'::jsonb,
    :'user_id'::uuid
  ),
  (
    'GPS unit offline — Unit 7',
    'Tracker stopped reporting yesterday evening.',
    'in_progress',
    'urgent',
    :'user_id'::uuid,
    now() - interval '1 day',
    array['fleet','telematics'],
    '{"unit_number":"7","vehicle":"Transit","driver":"A. Chen"}'::jsonb,
    :'user_id'::uuid
  ),
  (
    'Update SOPs for night dispatch',
    'Draft checklist for after-hours handoff.',
    'blocked',
    'med',
    null,
    now() + interval '14 days',
    array['ops'],
    '{}'::jsonb,
    :'user_id'::uuid
  ),
  (
    'Close Q3 expense audit',
    'All receipts uploaded; awaiting sign-off.',
    'done',
    'low',
    :'user_id'::uuid,
    now() - interval '5 days',
    array['admin'],
    '{}'::jsonb,
    :'user_id'::uuid
  );
*/
