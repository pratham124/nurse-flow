-- Read-only catalog capture; no application records.
BEGIN READ ONLY;
SELECT 'functions' AS section, p.proname AS name,
 jsonb_build_object('schema', n.nspname, 'identity_arguments', pg_get_function_identity_arguments(p.oid), 'definition', pg_get_functiondef(p.oid), 'owner', pg_get_userbyid(p.proowner), 'acl', p.proacl, 'settings', p.proconfig) AS metadata
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind IN ('f','p')
ORDER BY p.proname;
COMMIT;
