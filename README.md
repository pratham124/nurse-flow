# NurseFlow

NurseFlow is a React Native mobile app built with Expo and TypeScript.

The app helps hospital charge nurses manage floor setup, shift assignments, patient acuity, nurse workloads, and related shift workflow.

## App Overview

NurseFlow is designed for charge nurses who need a clearer way to organize a hospital floor before and during a shift.

At a high level, the app will support:

- Floor setup with rooms, beds, and doctor sides.
- Shift setup from a reusable floor template.
- Nurse profiles with license type, experience level, and max patient load.
- Patient entry with bed location, initials, age, sex, diagnosis, and acuity.
- Assignment logic that balances nurse teams, room coverage, and bed-level patient assignments.
- A compact charge nurse floor board for reviewing census, acuity, nurse workload, unassigned beds, and imbalance flags.

## Project Docs

Useful project docs:

- `AGENTS.md` - project rules and workflow.
- `docs/product-spec.md` - full product specification.

## Setup

### Requirements

- Node.js installed.
- npm installed.
- A phone with Expo Go, an Android emulator, an iOS simulator, or a web browser for local testing.

### Install Dependencies

```bash
npm install
```

### Start The App

```bash
npm start
```

Expo will show options for opening the app on Android, iOS, web, or Expo Go.

### Useful Commands

```bash
npm run android
npm run ios
npm run web
npm run lint
```

## Source Structure

- `src/app` - Expo Router app screens and layout.
- `assets` - static app assets.
- `docs` - product and planning docs.

## Done Criteria

A task is done only when:

- The app runs without errors.
- The feature can be tested manually.
- The code remains readable and beginner-friendly.
