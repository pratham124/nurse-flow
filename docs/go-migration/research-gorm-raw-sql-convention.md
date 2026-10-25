# Research: GORM builder vs raw SQL

Question: in GORM v2 with Postgres, when should code use the query builder and when should it use `Raw(...).Scan` or `Exec`? This note checks the repo's current rule against GORM's own docs and source.

Versions checked: `gorm.io/gorm v1.31.2` and `gorm.io/driver/postgres v1.6.3`, the versions pinned in `backend/go.mod`. Source links point to those tags. Docs were read on 2026-10-24.

Each claim is labelled as one of three kinds:

- **Documented**: the official docs at gorm.io say it.
- **Implementation**: it is only in the source code, so it could change without notice.
- **Opinion**: my own judgment, or a convention I could not trace to a primary source.

## 1. Does GORM say when to use raw SQL?

- **Documented:** no. The [SQL Builder page](https://gorm.io/docs/sql_builder.html) shows `Raw(...).Scan` and `Exec` as normal, supported features. It gives no rule for choosing between them and the builder.
- **Documented:** the closest it comes is the "Clause Options" section of the same page. It mentions advanced clause options for cases where "GORM public API can't match your requirements". The [advanced query page](https://gorm.io/docs/advanced_query.html) also sends readers to "Raw SQL and SQL Builder" for "more advanced locking strategies".
- **Opinion:** a common rule of thumb is "builder for CRUD, raw SQL for anything complex". I found no primary source that states it. Treat it as community convention only.

## 2. JOIN queries

GORM has three ways to write a join:

1. **String joins**, such as `Joins("JOIN emails ON ...")`.
   - **Documented:** the [Joins section of the query page](https://gorm.io/docs/query.html#Joins) shows them, usually together with `Select("users.name, emails.email")` and `Scan` into a result struct.
   - **Implementation:** the string is inserted as raw SQL through `clause.NamedExpr{SQL: join.Name, ...}` ([`callbacks/query.go` L256–L261](https://github.com/go-gorm/gorm/blob/v1.31.2/callbacks/query.go#L256-L261)).
2. **Association joins**, such as `Joins("Company")` or `InnerJoins("Company")`.
   - **Documented:** these load a related struct in a single SQL query using a `LEFT JOIN` (or an `INNER JOIN`). Each joined column gets an alias like `Company__id` ([query page](https://gorm.io/docs/query.html#Joins-Preloading)).
   - **Documented:** the model needs a relationship field for this to work. "Join Preload works with one-to-one relation, e.g: has one, belongs to" ([preload page](https://gorm.io/docs/preload.html)).
   - **Implementation:** `Joins` defaults to `clause.LeftJoin` ([`chainable_api.go` L248](https://github.com/go-gorm/gorm/blob/v1.31.2/chainable_api.go#L248)).
3. **`Raw`.**
   - **Documented:** it is always allowed. The docs give no guidance on choosing it over 1 or 2 for joins.

### Which columns does a string join select when you don't call `Select`?

- **Implementation:** confirmed in `BuildQuerySQL` ([`callbacks/query.go` L109–L115](https://github.com/go-gorm/gorm/blob/v1.31.2/callbacks/query.go#L109-L115)). When the statement has joins, no `Select`, no `Omit`, and a parsed model, GORM writes out every column of the model's own table, qualified with the table name: `"table"."col1", "table"."col2", ...`. It does not use `SELECT *`. So columns from the joined table are not read and cannot collide with the model's columns.
- **Documented, by example only:** the "Joins a Derived Table" example on the [query page](https://gorm.io/docs/query.html#Joins-a-Derived-Table) prints generated SQL in exactly that form: ``SELECT `order`.`user_id`,`order`.`finished_at` FROM `order` join (...)``. No sentence in the docs states this as a rule.
- **Conclusion:** the behaviour is reliable today, but it counts as an implementation detail. If code depends on it, an explicit `Select("table.*")` or a short comment makes the intent clear.

## 3. Database functions and Postgres-specific statements

| Need | First-class builder feature? | Source |
| --- | --- | --- |
| `now()` as a value in an insert or update | Yes. Use `gorm.Expr("now()")` or `clause.Expr` in `Updates`/`UpdateColumn`, or in a map `Create`. | **Documented**: [update page](https://gorm.io/docs/update.html), [create page, "Create From SQL Expression"](https://gorm.io/docs/create.html) |
| Reading `SELECT now()` on its own | No builder form is documented. | **Documented**: `Raw` is the only documented route ([SQL Builder page](https://gorm.io/docs/sql_builder.html)) |
| `pg_advisory_xact_lock`, `set_config` | No. These are function calls, not table queries. | **Documented**: `Exec` ([SQL Builder page](https://gorm.io/docs/sql_builder.html)) |
| `SELECT ... FOR UPDATE` | Yes: `clause.Locking{Strength: "UPDATE"}` | **Documented**: [advanced query page](https://gorm.io/docs/advanced_query.html) |
| `INSERT ... ON CONFLICT` | Yes: `clause.OnConflict{Columns, DoNothing, DoUpdates, UpdateAll, OnConstraint, TargetWhere}` | **Documented**: [create page, "Upsert / On Conflict"](https://gorm.io/docs/create.html). Struct fields: [`clause/on_conflict.go`](https://github.com/go-gorm/gorm/blob/v1.31.2/clause/on_conflict.go) |
| `RETURNING` | Yes: `clause.Returning{Columns: ...}` | **Documented** for updates: [update page](https://gorm.io/docs/update.html). The Postgres driver enables it for create, update and delete: [`postgres.go` L79–L87](https://github.com/go-gorm/postgres/blob/v1.6.3/postgres.go#L79-L87) |

Two facts about reading a generated id back after an insert:

- **Documented:** "When creating from map, hooks won't be invoked, associations won't be saved and primary key values won't be back filled" ([create page](https://gorm.io/docs/create.html)).
- **Implementation:** a struct `Create` on Postgres adds `RETURNING` on its own for any field that has a database default ([`callbacks/create.go` L52–L63](https://github.com/go-gorm/gorm/blob/v1.31.2/callbacks/create.go#L52-L63)).
- **Implementation, untested:** the scanner also has a case that writes into a map ([`scan.go` L147](https://github.com/go-gorm/gorm/blob/v1.31.2/scan.go#L147)). That suggests a map `Create` with an explicit `clause.Returning` would copy the returned columns into the map. This is not documented and was not tested in this repo, so do not rely on it.

## 4. Raw/Exec and SQL injection

All of the following is **documented** on the [security page](https://gorm.io/docs/security.html):

- GORM uses `database/sql` placeholders, which "will automatically escape arguments to avoid SQL injection". User input should be used "only as an argument".
- `Raw`, `Exec`, `Joins`, `InnerJoins`, `Select`, `Order`, `Table`, `Group` and several other methods are listed as "SQL injection methods". Their SQL string is not escaped, so user input must never be formatted or concatenated into that string.
- "Despite being parameterized in Exec() function, gorm.Expr is still injectable."
- Logged SQL and `ToSQL` output are "not fully escaped". Use them for debugging only ([SQL Builder page](https://gorm.io/docs/sql_builder.html)).

In short, `Raw`/`Exec` with `?` placeholders are exactly as safe as the builder. A string `Joins` carries the same risk as `Raw`.

## 5. How the repo's rule compares

The rule found in `backend/internal/database/`:

> Builder for simple single-table reads, inserts and updates. Raw SQL, with a comment explaining why, for joins, database function calls, Postgres-specific statements, and one insert whose id must be read back.

What the code actually does:

- **Function calls:**
  - `connection.go`: `set_config` through `Exec`, and a catalog check through `Raw`.
  - `joining.go`: `SELECT now()` and `pg_advisory_xact_lock`.
  - `shifts.go`: two more advisory locks.
- **Joins:** one join in `invites.go`, `newestLinkedAccess`, through `Raw`.
- **ON CONFLICT:** `profiles.go`, `EnsureProfile`, through `Exec`.
- **Insert with database-clock expiry and RETURNING:** `invites.go`, `issueInvite`.
- **Builder features already in use:**
  - `clause.Locking` and `clause.Returning` with a narrow `accessInsert` struct (`joining.go`).
  - `gorm.Expr("now()")` inside `Updates` (`invites.go`, `joining.go`).

### Assessment

The rule fits the primary sources. GORM documents `Raw` and `Exec` as first-class features and never discourages them. Every raw call passes values through placeholders, as the security page requires. The only string concatenation is the `inviteColumns` constant in `issueInvite`, which is not user input. Using raw SQL for advisory locks, `set_config` and reading `now()` is the only documented option. **(Opinion)** Requiring a "why" comment on each raw call is a good local habit, not a GORM requirement.

### Places where a builder feature exists (opinion on the trade-offs)

1. **`EnsureProfile`: `clause.OnConflict` instead of raw `ON CONFLICT`.**
   - Possible change: reuse the repo's own `accessInsert` approach. A small `profileInsert` struct with only the granted columns avoids writing `created_at`/`updated_at`. Then call `tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "auth_user_id"}}, DoNothing: true}).Create(&row)`.
   - Gain: no raw SQL.
   - Cost: one more mapping type, and the generated SQL is less visible. The current four-line statement is arguably easier for a beginner to read.
2. **`newestLinkedAccess`: a string `Joins` instead of `Raw`.**
   - Possible change: `tx.Joins("JOIN public.active_shifts s ON s.id = shift_nurse_access.shift_id").Where(...).Order(...).Limit(1).Find(&rows)`. GORM would select only the access table's columns (section 2).
   - Cost: the join text is still raw SQL, and it relies on the implementation detail above.
   - An association join (`Joins("Shift")`) would need a `Shift` relationship field on `AccessRow` just for this query, and it would also load the shift's columns.
   - Keeping `Raw` with an explicit `SELECT a.*` is defensible.
3. **`issueInvite` insert.**
   - Possible change: a struct `Create` with `clause.Returning` would read back the id and timestamps. But the expiry `now() + interval '24 hours'` would then need a custom `GormValuer` field type, the second method on the "Create From SQL Expression" page.
   - A map `Create` accepts `clause.Expr` but does not back-fill (documented).
   - **(Opinion)** `Raw` is the simplest correct choice here. The current comment is accurate.

There are no places where raw SQL hides a security problem or ignores a documented GORM recommendation.
