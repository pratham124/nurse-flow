# NurseFlow

NurseFlow is a React Native mobile app built with Expo and TypeScript.

The app helps hospital charge nurses manage floor setup, shift assignments, patient acuity, nurse workloads, and related shift workflow.

## App Overview

NurseFlow is designed for charge nurses who need a clearer way to organize a hospital floor before and during a shift.

The app supports:

- Floor setup with rooms, beds, and doctor sides.
- Shift setup from a reusable floor template.
- Nurse profiles with license type, experience level, and max patient load.
- Patient entry with bed location, initials, age, sex, diagnosis, and acuity.
- Assignment logic that balances nurse teams, room coverage, and bed-level patient assignments.
- A compact charge nurse floor board for reviewing census, acuity, nurse workload, unassigned beds, and imbalance flags.

## Architecture

### Current architecture

The Expo app uses Supabase Auth for login and accesses application data through
Supabase's Data API. Postgres holds the data, RLS policies, PL/pgSQL workflow
functions, and triggers. A separate Python optimizer runs on Google Cloud Run.

```mermaid
flowchart TD
    App["Expo app · React Native / TypeScript"]
    Auth["Supabase Auth"]
    API["Supabase Data API"]
    DB["Supabase Postgres · Tables / JSONB snapshots<br/>RLS / RPC functions / triggers"]
    subgraph CloudRun["Google Cloud Run"]
        Optimizer["Python optimizer · FastAPI / OR-Tools"]
    end
    Realtime["Supabase Realtime"]

    App <-->|"Sign-in and token refresh"| Auth
    App <-->|"Table queries and RPC calls"| API
    API <--> DB
    App <-->|"Authenticated assignment requests"| Optimizer
    Optimizer <-->|"Prepare and finalize RPCs"| API
    DB -->|"Change events and broadcasts"| Realtime
    Realtime -->|"Updates prompt data reloads"| App
```

### Planned Go architecture

The planned Go API uses `net/http` for HTTP handling, service functions for
authorization and business logic, and GORM for Postgres access. Supabase Auth,
Realtime, and the Python optimizer remain separate services. The Go API is not
implemented yet.

```mermaid
flowchart TD
    App["Expo app · React Native / TypeScript"]
    Auth["Supabase Auth"]
    subgraph GoAPI["Planned Go API"]
        HTTP["net/http · Verify access token"]
        Service["Service functions · Authorization and business rules"]
        ORM["GORM · Queries and explicit transactions"]
        HTTP --> Service --> ORM
    end
    DB["Supabase Postgres · Existing schema and JSONB snapshots<br/>Constraints / indexes / retained policies and triggers"]
    Realtime["Supabase Realtime"]
    subgraph CloudRun["Google Cloud Run"]
        Optimizer["Python optimizer · FastAPI / OR-Tools"]
    end
    API["Supabase Data API · Existing optimizer RPCs"]

    App <-->|"Sign-in and token refresh"| Auth
    App <-->|"HTTPS JSON requests with access token"| HTTP
    ORM <-->|"Dedicated database role"| DB
    App <-->|"Existing assignment path"| Optimizer
    Optimizer <--> API
    API <--> DB
    DB -->|"Change events and broadcasts"| Realtime
    Realtime -->|"Updates prompt data reloads"| App
```

## Setup

### Requirements

- Node.js installed.
- npm installed.
- A configured Supabase project and optimizer service.
- An Android emulator, iOS simulator, development build on a phone, or web browser.

### Install Dependencies

```bash
npm install
```

### Configure Environment

Copy `.env.example` to `.env` and set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_OPTIMIZER_SERVICE_URL=https://your-optimizer-service.example
```

Use the Supabase publishable key in the app. Database credentials and secret keys
belong only on the backend. Restart Expo after changing these values.

For backend setup, see the [Supabase setup guide](docs/phase-5/supabase-auth-setup.md)
and [optimizer service instructions](optimizer-service/README.md).

### Start The App

```bash
npm start
```

Expo will show the available development targets.

### Useful Commands

```bash
npm run android
npm run ios
npm run web
npm run lint
```
