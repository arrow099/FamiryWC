# Project Structure and Naming

Date: 2026-06-19

## Runtime Structure

```text
app/
  layout.tsx
  page.tsx
components/
  AppThemeProvider.tsx
  Dashboard.tsx
hooks/
  useEspnLiveMatches.ts
lib/
  app-data/
    buildAppData.ts
    deriveTournamentResults.ts
    normalizePicks.ts
    scoring.ts
    standings.ts
  providers/
    espn.ts
  schemas/
    appData.ts
    familyPicks.ts
    matches.ts
data/
  family_bracket_picks.json
  scoring_rules.json
test/
  e2e/
```

## Ownership

- `app/` assembles server-rendered stable data and mounts the dashboard. It contains no live-data route handlers.
- `components/` owns rendering and tab interaction.
- `hooks/` owns browser lifecycle behavior such as visibility-aware polling.
- `lib/providers/` fetches and normalizes third-party payloads into app contracts.
- `lib/app-data/` validates stable picks and derives standings, bracket outcomes, and scores.
- `lib/schemas/` owns shared TypeScript and validation contracts.
- `data/` contains committed source data, never mutable runtime state.
- `test/` contains Vitest unit/component tests and Playwright browser tests.

## Runtime Rules

- Pass `StaticAppData` from `app/page.tsx` to the client dashboard.
- Keep normalized `Match[]` as the shared live snapshot.
- Do not introduce a monolithic refreshed app-state job in the browser.
- Compute live-derived standings and scoring only in the tab that consumes them.
- Keep ESPN-specific response types and parsing inside `lib/providers/espn.ts`.
- Do not add secrets, provider tokens, or server-only environment variables to client code.

## Naming

- React components and component files use `PascalCase`.
- Hooks use `useCamelCase` and live in `hooks/`.
- Utility modules and functions use `camelCase`.
- Types use `PascalCase`; constants use `UPPER_SNAKE_CASE` when global and immutable.
- Stable IDs retain prefixes such as `team_`, `member_`, and `match_`.
- Tests use `*.test.ts` or `*.test.tsx`; browser specs use `*.spec.ts` under `test/e2e/`.

## Removed Server Surface

The client-side branch intentionally has no `app/api/`, `vercel.json`, Blob storage adapter, cron refresh module, generated `public/data.json`, or local cron script. Reintroducing any of these changes the architecture and requires updating `docs/v1` first.
