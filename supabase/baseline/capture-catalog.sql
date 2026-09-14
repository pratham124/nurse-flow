-- Schema metadata only. No application rows, Auth users, secrets, or sequence values.
BEGIN READ ONLY;
WITH objects AS (
 SELECT 'database' AS section, current_database() AS name, jsonb_build_object('server_version',current_setting('server_version'),'captured_at',current_timestamp) AS metadata
 UNION ALL
 SELECT 'tables',c.relname,jsonb_build_object('schema',n.nspname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'replica_identity',c.relreplident,'acl',c.relacl,'options',c.reloptions,'comment',obj_description(c.oid,'pg_class'))
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
 UNION ALL
 SELECT 'columns',c.relname||'.'||a.attname,jsonb_build_object('table',c.relname,'name',a.attname,'position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl,'comment',col_description(c.oid,a.attnum))
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL
 SELECT 'constraints',c.relname||'.'||k.conname,jsonb_build_object('table',c.relname,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid,false),'validated',k.convalidated,'deferrable',k.condeferrable,'initially_deferred',k.condeferred)
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL
 SELECT 'indexes',i.indexname,to_jsonb(i) FROM pg_indexes i WHERE i.schemaname='public'
 UNION ALL
 SELECT 'triggers',n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid,false))
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR pn.nspname='public')
 UNION ALL
 SELECT 'policies',p.schemaname||'.'||p.tablename||'.'||p.policyname,to_jsonb(p) FROM pg_policies p WHERE p.schemaname IN ('public','realtime','storage','auth')
 UNION ALL
 SELECT 'extensions',e.extname,jsonb_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion,'relocatable',e.extrelocatable) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
 UNION ALL
 SELECT 'schemas',n.nspname,jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl) FROM pg_namespace n WHERE n.nspname IN ('public','auth','realtime','storage','extensions')
 UNION ALL
 SELECT 'default_privileges',pg_get_userbyid(d.defaclrole)||'.'||coalesce(n.nspname,'global')||'.'||d.defaclobjtype::text,jsonb_build_object('role',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'object_type',d.defaclobjtype,'acl',d.defaclacl) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname='public' OR d.defaclnamespace=0
 UNION ALL
 SELECT 'sequences',s.sequencename,(to_jsonb(s)-'last_value') FROM pg_sequences s WHERE s.schemaname='public'
 UNION ALL
 SELECT 'publications',p.pubname,jsonb_build_object('name',p.pubname,'owner',pg_get_userbyid(p.pubowner),'all_tables',p.puballtables,'insert',p.pubinsert,'update',p.pubupdate,'delete',p.pubdelete,'truncate',p.pubtruncate,'via_partition_root',p.pubviaroot) FROM pg_publication p
 UNION ALL
 SELECT 'publication_tables',p.pubname||'.'||p.schemaname||'.'||p.tablename,to_jsonb(p) FROM pg_publication_tables p
 UNION ALL
 SELECT 'types',t.typname,jsonb_build_object('name',t.typname,'kind',t.typtype,'base_type',format_type(t.typbasetype,t.typtypmod),'not_null',t.typnotnull,'default',t.typdefault,'enum_labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype IN ('e','d')
 UNION ALL
 SELECT 'views',v.viewname,to_jsonb(v) FROM pg_views v WHERE v.schemaname='public'
)
SELECT section,name,metadata FROM objects ORDER BY section,name;
COMMIT;
