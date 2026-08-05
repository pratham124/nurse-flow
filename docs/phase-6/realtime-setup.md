# Phase 6 Realtime Setup

Phase 6 Task 1.2 uses Supabase Postgres Changes for the charge nurse active-shift listener.

Supabase requires each table that should emit Postgres Changes to be enabled for the `supabase_realtime` publication.

Run this in the Supabase SQL editor before validating Task 1.2 against another session or backend update:

```sql
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'active_shifts'
  ) then
    alter publication supabase_realtime
    add table public.active_shifts;
  end if;
end;
$$;
```

The membership check makes the setup safe to run again. The important outcome
is that `public.active_shifts` is enabled for realtime updates.

Task 1.2 still keeps realtime as a foreground app listener. This setup does not add push notifications, offline queues, conflict resolution, invites, or joined-nurse subscriptions.
