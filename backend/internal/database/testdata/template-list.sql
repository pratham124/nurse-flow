-- Additional local-only fixtures for sorting and two nonempty owners.
-- Apply after testdata/schema.sql. Never apply this file to Supabase.
INSERT INTO public.profiles (id, auth_user_id, display_name, role) VALUES
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'Charge Gamma', 'charge_nurse'),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'Charge Delta', 'charge_nurse');

INSERT INTO public.floor_templates (id, owner_profile_id, name, template_snapshot, updated_at) VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Older Gamma floor',
   '{"id":"old-snapshot-id","name":"old snapshot name","doctorSides":[],"rooms":[],"beds":[],"futureField":42}', '2026-10-01T00:00:00Z'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005', 'Newest Delta floor',
   '{"doctorSides":[],"rooms":[],"beds":[]}', '2026-10-17T00:00:00Z'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'Newer Gamma floor A',
   '{"doctorSides":[],"rooms":[],"beds":[]}', '2026-10-16T00:00:00Z'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 'Newer Gamma floor B',
   '{"doctorSides":[],"rooms":[],"beds":[]}', '2026-10-16T00:00:00Z');
