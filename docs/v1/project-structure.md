# Project Structure and Naming: Famiry World Cup v1

Date: 2026-06-18

## Purpose

Define the expected file and folder structure for the v1 Next.js app, plus naming conventions for source files, generated files, and runtime artifacts.

These conventions keep the app easy to navigate as it grows from the current static dashboard into a live-data bracket app.

## Top-Level Structure

```text
app/
  layout.tsx
  page.tsx
  api/
    data/route.ts
    cron/refresh/route.ts
components/
  AppShell.tsx
  MemberSelector.tsx
  OverviewStats.tsx
  ChampionPicks.tsx
  GroupPicksView.tsx
  ThirdPlacePicksView.tsx
  KnockoutBracket.tsx
  ComparePicks.tsx
lib/
  app-data/
    buildAppData.ts
    normalizePicks.ts
    normalizeMatches.ts
    refreshLiveData.ts
  schemas/
    appData.ts
    familyPicks.ts
    matches.ts
  providers/
    espn.ts
data/
  family_bracket_picks.json
  scoring_rules.json
public/
  data.json
scripts/
  build-data.ts
runtime/
  raw/
docs/
  discovery/
  v1/
```

## Folder Responsibilities

`app/` contains Next.js routes, layouts, pages, and route handlers. Keep route-specific code here only when it is tightly coupled to the route.

`app/api/` contains server-side API routes. Browser code should call our API routes, not ESPN, FIFA, or other providers directly.

`components/` contains reusable React UI components. Components should receive normalized app-state data, not raw provider or extraction payloads.

`lib/app-data/` contains data assembly logic: loading source files, normalizing picks, normalizing match data, building app state, and refreshing cached live data.

`lib/schemas/` contains validation schemas and TypeScript types for source data, provider data, and generated app state.

`lib/providers/` contains server-only provider adapters. Each provider module should normalize external responses before they reach the app-state builder.

`data/` contains durable source data that can be reviewed and edited in the repo.

`public/` contains static browser assets and fallback generated data. `public/data.json` is a deploy-time seed or fallback, not the live source during the tournament.

`scripts/` contains local and deployment scripts used to validate data, generate app state, or run maintenance tasks.

`runtime/` contains local raw provider captures and other operational artifacts. Treat this as temporary runtime output unless a fixture is intentionally promoted elsewhere.

`docs/discovery/` contains research and source notes.

`docs/v1/` contains the active v1 product, architecture, data, and implementation conventions.

## File Naming

Use file names that describe the module's responsibility.

React component files:

```text
PascalCase.tsx
```

Examples:

```text
AppShell.tsx
MemberSelector.tsx
KnockoutBracket.tsx
```

Route files follow Next.js conventions:

```text
page.tsx
layout.tsx
route.ts
loading.tsx
error.tsx
not-found.tsx
```

General TypeScript modules use camelCase:

```text
buildAppData.ts
normalizePicks.ts
refreshLiveData.ts
```

Schema modules use camelCase and should match the data contract they validate:

```text
appData.ts
familyPicks.ts
matches.ts
```

Provider modules use lowercase provider names:

```text
espn.ts
fifa.ts
```

JSON source files use snake_case:

```text
family_bracket_picks.json
scoring_rules.json
```

Generated static app-state files should be explicit:

```text
public/data.json
```

If additional generated files are added, prefer descriptive kebab-case or snake_case and document the generator that owns them.

Documentation files use kebab-case:

```text
data-model.md
project-structure.md
```

## Naming Inside Code

Use PascalCase for React components and TypeScript types:

```text
AppShell
MemberSelector
AppData
FamilyPickSource
```

Use camelCase for functions, variables, and object fields:

```text
buildAppData
normalizeMatches
capturedAt
providerIds
```

Use UPPER_SNAKE_CASE only for true constants that are not expected to vary at runtime:

```text
VALID_ROUNDS
GROUP_IDS
```

Use stable string IDs in app state. Do not use provider IDs as primary app IDs.

```text
team_arg
member_leppy27
match_001
R32-1
```

## Generated and Runtime Files

Generated app-state files must be reproducible from source data and provider state.

`public/data.json` is committed as the fallback seed in the deployed app. Live tournament state should come from `/api/data` reading cached normalized state.

Raw provider responses belong in `runtime/raw/` during development. Promote a raw response into a committed test fixture only when it is needed for repeatable validation.

Do not manually edit generated leaderboard or derived standings data. Change the source picks, scoring rules, provider fixtures, or app-state builder instead.

## Import Boundaries

Components may import shared UI helpers and app-state types.

Components should not import provider modules.

Provider modules should not import React components.

API routes may import app-data builders, schemas, provider adapters, and storage helpers.

Data-generation scripts may import schemas, providers, and app-data builders, but should keep side effects explicit.

## UI Conventions

Use Material UI for the v1 component system. Prefer Material UI layout, tabs, tables, controls, chips, alerts, and theme primitives before adding custom UI building blocks.

Keep the UI dense and scannable. This is a private sports-dashboard app, not a marketing page.

Use custom CSS only when Material UI theme tokens or component props are not enough.
