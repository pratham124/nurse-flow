-- Synthetic local-only fixture. Never apply this file to Supabase.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, auth_user_id uuid NOT NULL UNIQUE, display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('charge_nurse', 'regular_nurse')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.floor_templates (
  id uuid PRIMARY KEY, owner_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL, template_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.active_shifts (id uuid PRIMARY KEY);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_templates ENABLE ROW LEVEL SECURITY;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- Stand-in for a retained client-facing function; no workflow logic is copied.
-- Clients may execute it, while the Go database role must not be able to.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION public.register_device_push_token(uuid, uuid, text, text, text) RETURNS text LANGUAGE sql SECURITY DEFINER AS 'SELECT $3';
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
INSERT INTO public.profiles (id, auth_user_id, display_name, role) VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Charge Alpha', 'charge_nurse'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Charge Beta', 'charge_nurse'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Regular Nurse', 'regular_nurse');
INSERT INTO public.floor_templates (id, owner_profile_id, name, template_snapshot) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Migration Test Floor', '{"doctorSides":[],"rooms":[],"beds":[]}'),
  -- Deliberate role-boundary fixture: even its owner cannot read this as a regular nurse.
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
   'Regular Role Boundary', '{"doctorSides":[],"rooms":[],"beds":[]}');
