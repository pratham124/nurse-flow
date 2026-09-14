-- Run on the DEVELOPMENT project before preparing its final restore.
-- Read-only metadata inspection; no application records or credentials.
BEGIN READ ONLY;
SELECT current_user AS restore_role, current_setting('server_version') AS server_version;
SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
ORDER BY c.relname;
SELECT n.nspname AS schema, p.proname AS name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
   OR (n.nspname = 'auth' AND p.proname IN ('uid','role'))
   OR (n.nspname = 'extensions' AND p.proname = 'digest')
   OR (n.nspname = 'realtime' AND p.proname IN ('send','topic'))
ORDER BY n.nspname, p.proname;
SELECT to_regclass('auth.users') AS auth_users,
       to_regclass('realtime.messages') AS realtime_messages;
SELECT pg_get_userbyid(d.defaclrole) AS owner,
       n.nspname AS schema, d.defaclobjtype AS object_type, d.defaclacl AS acl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE d.defaclnamespace = 0 OR n.nspname = 'public';
SELECT nspname, pg_get_userbyid(nspowner) AS owner, nspacl
FROM pg_namespace WHERE nspname IN ('public','auth','realtime','extensions');
SELECT extname, extversion, extnamespace::regnamespace AS schema FROM pg_extension;
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public','realtime');
SELECT pubname, schemaname, tablename, attnames, rowfilter FROM pg_publication_tables;
COMMIT;
