# Live Supabase Schema Review

Inspected: 2026-09-12 through the signed-in Supabase dashboard.
Project: `nurseflow`, project ref `mkljczezkyqtuplzedpj`, dashboard branch `main` marked Production, region `us-east-1`.

Status: read-only dashboard inspection completed. This is an observed inventory, not an executable schema baseline or a complete security audit. No database writes, SQL execution, policy saves, role changes, or application data exports were performed. Function/policy editor panels were closed without saving.

## What this establishes

- The `public` schema contains 11 application tables.
- The Functions page lists 29 public functions: 28 marked Definer and `optimizer_output_validation_error` marked Invoker. This includes trigger helpers, not only client-callable RPCs. Execute grants were not verified.
- The Triggers page lists seven row triggers.
- All 11 public tables have RLS enabled, as indicated by their Disable RLS controls. Their policy availability differs; see below.
- The Migrations page displays the first-migration setup instructions; the overview reports no migrations.
- The Roles page lists Supabase-managed roles plus `postgres` and `supabase_privileged_role`; no dedicated NurseFlow Go role was visible.

## Public table inventory

Column counts and nullable fields below were inspected on each table's column page. All tables have a UUID `id` primary key. Types and nullability must be mapped explicitly; do not infer them solely from current TypeScript types.

| Table | Columns | Important fields and relationships | Nullable fields observed |
| --- | --- | --- | --- |
| profiles | 6 | `auth_user_id` is a unique, non-null UUID FK; `display_name`, `role`, timestamps | None |
| floor_templates | 6 | `owner_profile_id` UUID FK, `name`, `template_snapshot` JSONB, timestamps | None |
| active_shifts | 8 | `charge_profile_id` UUID FK, `floor_template_id` UUID FK, `status`, `shift_snapshot` JSONB, timestamps | `floor_template_id`, `ended_at` |
| previous_shift_snapshots | 6 | Charge/profile and template FKs; `completed_at`; `nurse_suggestions`, `patient_suggestions` JSONB | `floor_template_id` |
| shift_nurse_access | 9 | Shift/profile FKs; `nurse_id` text, `nurse_name`, `nurse_email`, `status`, timestamps | `nurse_profile_id`, `nurse_email` |
| shift_nurse_invites | 12 | Shift/creator/user profile FKs; `nurse_id` text, `token_hash`, `status`, expiry and timestamps | `used_at`, `used_by_profile_id`, `revoked_at` |
| device_push_tokens | 10 | Profile FK; `device_id` UUID, platform, push token, status, permission status, timestamps | None |
| notification_events | 14 | Shift/recipient profile/access FKs; event type, route, request/bed IDs, title/body, status and timestamps | `recipient_access_id`, `related_request_id`, `related_bed_id`, `sent_at`, `failure_reason` |
| manual_assignment_overrides | 14 | Shift/creator FKs; baseline, bed and nurse text IDs; `server_sequence` int8 identity; warning acknowledgements JSONB; mutation ID | `superseded_at`, `related_swap_request_id` |
| nurse_request_messages | 7 | Shift/author FKs; request ID, body, timestamp, mutation ID | `client_mutation_id` |
| optimizer_runs | 16 | Shift/requester FKs; mutation ID, expected revision, fingerprints, version, status, result, JSONB summary, timestamps/duration | `expected_baseline_assignment_result_id`, `input_fingerprint`, `optimizer_version`, `result_id`, `completed_at`, `duration_ms` |

The visualizer shows the core relationship `auth.users.id -> profiles.auth_user_id`, with template ownership referencing `profiles.id`. Shift-related records reference `active_shifts`; template references in active/history records are nullable. Full FK definitions, including ON DELETE/UPDATE actions, still require export.

There are no separate public rooms, beds, patients, or nurses tables in this inventory. The existing application stores those structures inside JSONB snapshots. Preserve that representation for this migration. Snapshot contents were not read from live patient/shift rows.

## First endpoint: exact live read policies

The profile SELECT policy is permissive, applies to `authenticated`, and uses:

```sql
auth.uid() = auth_user_id
```

The floor-template SELECT policy is permissive, applies to `authenticated`, and uses:

```sql
EXISTS (
  SELECT 1
  FROM profiles
  WHERE profiles.id = floor_templates.owner_profile_id
    AND profiles.auth_user_id = auth.uid()
    AND profiles.role = 'charge_nurse'::text
)
```

Both conditions were read through View policy details. Neither SELECT policy has a CHECK expression.

Go must preserve the same authorization meaning: verify the token, resolve `profiles.auth_user_id` to the separate `profiles.id`, require the charge-nurse role, and filter templates by that profile ID. Never substitute the Auth user ID directly into `owner_profile_id` or trust a client-supplied owner ID.

Repository behavior reviewed alongside this inspection: `loadFloorTemplates` orders by `updated_at DESC`; the mapper validates snapshot arrays and uses the row ID/name. Its failure currently fails the surrounding workspace load. These are application facts, not ordering guarantees supplied by the database policy.

## RLS and Data API inventory

The following summarizes policy names/commands displayed, not a full review of every expression or grant. All listed policies target `authenticated`.

| Table | Policies shown |
| --- | --- |
| profiles | Owner INSERT, SELECT, UPDATE |
| floor_templates | Charge-owner INSERT, DELETE, SELECT, UPDATE |
| active_shifts | Charge-owner INSERT, SELECT, UPDATE |
| previous_shift_snapshots | Charge-owner INSERT, DELETE, SELECT |
| shift_nurse_access | Charge-owner ALL; joined-user SELECT of own access row |
| shift_nurse_invites | Charge-owner INSERT, DELETE, SELECT, UPDATE |
| manual_assignment_overrides | Charge-owner SELECT of override history |
| nurse_request_messages | Thread-participant SELECT |
| device_push_tokens | No policies shown |
| notification_events | No policies shown |
| optimizer_runs | No policies shown |

The dashboard labels overrides, messages, notification events, and optimizer runs as API Disabled/custom Data API permissions. This label is not a substitute for inspecting actual grants. RLS-enabled tables without policies are not automatically open: existing privileged/RPC access paths must be understood before giving the Go role access.

## Public function inventory

Observed names and security modes come from the Functions table. Full bodies were not captured in this pass; the function editor did not reliably expose complete text. Do not claim the live definitions match historical repository SQL until a schema export is compared.

- Invites: `validate_shift_nurse_invite_code`, `accept_shift_nurse_invite_code`.
- Assignment state: `confirm_manual_assignment_override`, `rerun_active_shift_assignment`, `reset_active_shift_for_editing`, `get_joined_nurse_assignment_view`.
- Requests/messages: `submit_joined_nurse_issue_request`, `submit_joined_nurse_swap_request`, `resolve_shift_nurse_swap_request`, `update_shift_nurse_issue_status`, `get_nurse_request_thread_actor`, `list_nurse_request_messages`, `append_nurse_request_message`.
- Optimizer: `prepare_optimizer_run`, `finalize_optimizer_run`, `fail_optimizer_run`, `optimizer_output_validation_error`.
- Device registration: `register_device_push_token`, `disable_current_device_push_token`.
- Notification helpers: `enqueue_notification_event`, `enqueue_request_activity_notification`, `enqueue_active_shift_change_notifications`, `enqueue_nurse_request_message_notification`, `enqueue_request_lifecycle_notifications`.
- Realtime helpers: `can_receive_nurseflow_broadcast`, `broadcast_nurseflow_access_change`, `broadcast_nurseflow_active_shift_change`, `broadcast_nurseflow_request_message`.
- Swap completion: `complete_swap_request_from_override`.

## Trigger dependencies

All seven listed triggers have ROW orientation; each invokes a same-named function. Enabled-state icons were not independently verified in this pass.

| Table | Event | Trigger/function |
| --- | --- | --- |
| active_shifts | AFTER UPDATE | broadcast_nurseflow_active_shift_change |
| active_shifts | AFTER UPDATE | enqueue_active_shift_change_notifications |
| active_shifts | AFTER UPDATE | enqueue_request_lifecycle_notifications |
| shift_nurse_access | AFTER UPDATE | broadcast_nurseflow_access_change |
| nurse_request_messages | AFTER INSERT | broadcast_nurseflow_request_message |
| nurse_request_messages | AFTER INSERT | enqueue_nurse_request_message_notification |
| manual_assignment_overrides | AFTER INSERT | complete_swap_request_from_override |

Migration implication: GORM writes to the same tables can invoke existing triggers. Audit the full definitions before moving writes so we neither lose side effects nor duplicate notifications/completion work in Go. Also inspect any dependence on Auth session context in trigger code.

## Index and Realtime observations

The Indexes page lists 27 indexes. Beyond primary keys, they include profile Auth-ID uniqueness, device/profile uniqueness, override history/idempotency/one-active-bed indexes, notification delivery/history indexes, message ordering/mutation indexes, optimizer idempotency/running/history indexes, and one-active-invite-per-nurse indexing.

The definition of `manual_assignment_overrides_one_active_bed` was read directly:

```sql
CREATE UNIQUE INDEX manual_assignment_overrides_one_active_bed
ON public.manual_assignment_overrides USING btree (shift_id, bed_id)
WHERE (status = 'active'::text);
```

Preserve this database guarantee even when Go owns the workflow. Names alone do not establish the exact predicates or uniqueness of other indexes; capture their definitions in the baseline export.

The Tables page marks `active_shifts` and `nurse_request_messages` Realtime-enabled. The Publications page shows `supabase_realtime` with two tables and `supabase_realtime_messages_publication` with one table; INSERT, UPDATE, DELETE, and TRUNCATE flags are checked for both. Publication membership details and Realtime-schema policies still need full capture. Broadcast triggers are additional dependencies; table publication flags alone do not describe all live-update behavior.

## Required before recreating the development project

1. Capture a schema-only baseline using a supported export workflow: complete tables/defaults/check constraints/FKs, sequences, all function bodies and settings, triggers, indexes, grants, RLS policies, and relevant publication membership.
2. Compare the export to repository SQL and document differences. The dashboard's Copy as SQL action did not yield readable clipboard content in this browser session, and the visualizer export would not establish all of these objects anyway.
3. Separate Supabase-managed objects from application-owned setup. Inspect required extensions, Auth settings, and Realtime configuration without copying live secrets or user records.
4. Apply the reviewed baseline only to the isolated development project, add synthetic data/test users, and validate the existing app there before Go integration.
5. Create/review the Go role and its exact permissions in development. Do not broadly weaken production RLS to make ORM access work.

## Dashboard references

- [Tables](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/tables)
- [Schema visualizer](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/schemas)
- [Functions](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/functions)
- [Triggers](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/triggers/data)
- [Policies](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/policies)
- [Indexes](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/indexes)
- [Publications](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/publications)
- [Migrations](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/migrations)
- [Roles](https://supabase.com/dashboard/project/mkljczezkyqtuplzedpj/database/roles)


## 2026-09-12 catalog capture follow-up

The full public function definitions and structural metadata are now saved in [the baseline capture](../../supabase/baseline/README.md). This supersedes earlier notes that function bodies, exact trigger conditions, and policy expressions were still unavailable. The capture contains 29 functions and 269 structural metadata rows, including 21 public policies and the scoped Realtime receive policy.

Exact trigger definitions confirm conditional snapshot notification triggers and the non-null swap-request condition; all seven triggers are enabled. The Auth foreign key is `profiles.auth_user_id → auth.users.id ON DELETE CASCADE`.

This remains a review reference, not a tested restore. Auth/project settings, full dependency/privilege review, a conventional dump or reviewed reconstruction, and development restore validation remain pending. No production schema or application records were changed.
