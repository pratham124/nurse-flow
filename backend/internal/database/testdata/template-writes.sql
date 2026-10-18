-- Local test database only. Match existing production defaults/reference actions.
ALTER TABLE public.floor_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.active_shifts ADD COLUMN floor_template_id uuid
  REFERENCES public.floor_templates(id) ON DELETE SET NULL;
CREATE TABLE public.previous_shift_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_template_id uuid REFERENCES public.floor_templates(id) ON DELETE CASCADE
);

-- Fail snapshot-ID synchronization after INSERT to prove transaction rollback.
-- This synthetic trigger exists only in the local test fixture.
CREATE FUNCTION public.test_reject_snapshot_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.name = 'Rollback Test' THEN RAISE EXCEPTION 'synthetic second-statement failure'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.test_reject_snapshot_sync() FROM PUBLIC;
CREATE TRIGGER test_reject_snapshot_sync BEFORE UPDATE ON public.floor_templates
  FOR EACH ROW EXECUTE FUNCTION public.test_reject_snapshot_sync();
