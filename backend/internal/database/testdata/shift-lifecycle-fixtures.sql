-- ISOLATED LOCAL POSTGRES ONLY. Fixed synthetic identities, no real users/data.
INSERT INTO auth.users(id) VALUES
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003');
INSERT INTO public.profiles(id,auth_user_id,display_name,role) VALUES
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Charge Alpha','charge_nurse'),
  ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Charge Beta','charge_nurse'),
  ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Regular Nurse','regular_nurse');
INSERT INTO public.floor_templates(id,owner_profile_id,name,template_snapshot) VALUES
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Migration Test Floor','{"doctorSides":[],"rooms":[],"beds":[]}'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','Regular Boundary','{"doctorSides":[],"rooms":[],"beds":[]}');
ALTER ROLE nurseflow_go LOGIN;
