# Phase 6 Realtime Setup

Phase 6 Task 1.2 uses Supabase Postgres Changes for the charge nurse active-shift listener.

Supabase requires each table that should emit Postgres Changes to be enabled for the `supabase_realtime` publication.

Run this in the Supabase SQL editor before validating Task 1.2 against another session or backend update:

```sql
alter publication supabase_realtime
add table public.active_shifts;
```

If the table is already part of the publication, Supabase may report that it is already a member. That is safe; the important outcome is that `public.active_shifts` is enabled for realtime updates.

Task 1.2 still keeps realtime as a foreground app listener. This setup does not add push notifications, offline queues, conflict resolution, invites, or joined-nurse subscriptions.
