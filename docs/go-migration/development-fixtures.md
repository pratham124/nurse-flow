# Development fixtures

Development project: `nurseflow-go-dev` (`nmitctyxtjmlakcsmnuj`). These fixtures are isolated from production and contain no production records.

## Test identities

| Email | Display name | Profile role | Purpose |
| --- | --- | --- | --- |
| `charge.alpha@example.com` | Charge Alpha | `charge_nurse` | Primary template owner and normal authorized flow |
| `charge.beta@example.com` | Charge Beta | `charge_nurse` | Cross-user ownership and empty-state checks |
| `regular.nurse@example.com` | Regular Nurse | `regular_nurse` | Authenticated-but-forbidden charge-nurse API checks |

All three identities were created through NurseFlow's existing signup screen on 2026-09-13. Email confirmation was disabled, so each signup returned a session immediately and `signUpWithEmail` created the matching `public.profiles` row through the signed-in client. The regular-nurse fixture was then changed from the app's default `charge_nurse` role to `regular_nurse` in the development database.

The shared development password was communicated outside the repository and is intentionally not recorded here. Do not reuse these accounts or credentials in production.

## Verification

- Each signup initially reached the NurseFlow home screen with the expected display name and an empty template list.
- A database join between `auth.users` and `public.profiles` returned exactly the three rows above.
- The two charge accounts retained `charge_nurse`; the authorization fixture has `regular_nurse`.

## Synthetic template

Charge Alpha created `Migration Test Floor` through the existing four-step app flow:

- Rooms: `101` with two beds and `102` with one bed
- Doctor sides: `East` and `West`
- Assignments: room `101` to East and room `102` to West

The existing app then demonstrated the intended boundaries: Charge Alpha listed the template, Charge Beta received the normal zero-template state, and Regular Nurse authenticated but was stopped by the current unsupported-role recovery screen.

A database query verified one `floor_templates` row owned by `charge.alpha@example.com`, with two rooms, three beds, and two doctor sides. `FloorTemplate` stores `rooms` and `beds` as separate top-level arrays; the room objects contain `bedCount` rather than nested bed arrays.
