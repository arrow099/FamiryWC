# Architecture: Famiry World Cup v1

Date: 2026-06-18

## Decision

Use Next.js with TypeScript and Material UI for v1, backed by local JSON files and a generated app-state contract.

Do not use a database in v1.

Primary flow:

```text
local picks + match provider data
        |
        v
normalizer + live-data refresher
        |
        v
cached/generated app state
        |
        v
Next.js UI
```

## Why This Architecture

This is a small app for about 30 people. Most of the data is already known and stable. The app needs a good browsing experience more than it needs a complex backend.

Next.js gives us:

- a modern React app structure
- route handlers if we need server-side JSON later
- a good deployment path through Vercel
- TypeScript support for data-heavy code

Material UI gives us:

- a proven React component system
- responsive layout primitives for a dense sports dashboard
- accessible tables, tabs, controls, chips, and alerts
- theming without creating a custom design system for v1

Plain Vite or static React would work for a bracket-only viewer. Next.js is the better fit for v1 because v1 includes live data and needs server-side provider boundaries, cache headers, API routes, and Vercel deployment hooks.

Local JSON gives us:

- easy inspection
- simple edits
- no auth or database maintenance
- a clear source of truth for v1

## Runtime Modes

### Mode 1: Generated JSON

Generate:

```text
public/data.json
```

The UI fetches:

```text
/data.json
```

This is the simplest mode and mirrors the friend's app.

Use this only for the static portion of the app or as a fallback snapshot. Runtime serverless code cannot mutate deployed `public/data.json` on Vercel, so this mode is not enough for v1 live data by itself.

### Mode 2: Next.js API Route

Expose:

```text
GET /api/data
```

The route returns the same app-state shape as `public/data.json`.

Use this for v1 live data. The route must read cached normalized state. Provider refresh happens through Vercel Cron or authenticated server-to-server calls. Browser requests must not directly fan out to ESPN/FIFA or trigger provider refresh.

### v1 Preference

Use `/api/data` for v1 because live data is in scope.

Refresh modes must stay explicit:

- Static artifact: `public/data.json` is generated before deploy and changes only by rebuild/redeploy; useful as fallback/static seed.
- API route: `/api/data` returns cached normalized state.
- Cron: Vercel cron calls `/api/cron/refresh`; it should not be described as rewriting deployed `public/data.json`.
- Storage: latest live app state should live in Vercel Blob or Redis so it survives function invocations.

## Proposed Structure

```text
app/
  layout.tsx
  page.tsx
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
public/
  data.json
scripts/
  build-data.ts
app/api/
  data/route.ts
  cron/refresh/route.ts
runtime/
  raw/
```

Start as one dashboard page with Material UI tabs/sections. Include provider modules and API routes in v1 because live data is required. Keep detailed file and naming conventions in `project-structure.md`.

## Data Refresh

Stable data:

- family picks
- teams
- members
- scoring rules

Live/changing data:

- match status
- match scores
- actual standings
- actual bracket outcomes
- leaderboard derived from actual results

Polling should exist only to read live/changing data. For implementation simplicity, the client can poll one app-state endpoint every 30 seconds during live match windows, but that endpoint must serve cached normalized app state. Provider refresh should be cron-controlled or triggered by authenticated server-to-server calls, not caused by browser poll or public UI controls. Vercel Cron uses minute-granularity schedules, so the Vercel-native high-frequency refresh cadence is every minute.

Recommended v1 live refresh path:

```text
Vercel Cron -> /api/cron/refresh -> ESPN fetch -> normalize -> write latest app state to Blob or Redis
Browser polling -> /api/data -> read latest cached app state
```

`public/data.json` can remain as a deploy-time fallback seed, but it is not the live source during the tournament.

## Provider Boundary

The browser should never call ESPN, FIFA, or other third-party providers directly.

Provider code belongs in:

```text
lib/providers/
```

Provider output should be normalized before React components see it.

This lets us replace ESPN later without rewriting the UI.

## Deployment

Recommended deployment: Vercel.

Initial deployment includes a static seed and live API routes:

- build the Next.js app
- include generated app-state JSON as fallback seed
- configure `/api/data`
- configure `/api/cron/refresh`
- configure Vercel Blob or Redis for latest app-state storage
- share the deployed URL with family

For live refresh:

- use Vercel cron or an external scheduled job to call `/api/cron/refresh`
- set `CRON_SECRET` so refresh fails closed outside local development
- store last-good state in the deploy artifact, external storage, or a committed generated file
- keep cache windows short during live matches

For v1, the simplest durable last-good live state is a JSON blob in Vercel Blob. Redis is also acceptable if we prefer key-value TTL semantics.

## Caching

For generated JSON:

```text
cache-control: public, max-age=30
```

Configure this through `next.config.ts` headers for `/data.json` if we serve a static file. Use `capturedAt` in the JSON so users can see freshness even if caches behave differently than expected.

For API route JSON:

```text
cache-control: s-maxage=30, stale-while-revalidate=60
```

Always include `capturedAt` and provider freshness metadata in the app state.

## Failure Handling

If match provider refresh fails:

- keep the last good app state
- mark match data stale
- keep picks and bracket views available
- avoid clearing leaderboard or match data unless explicitly regenerated

If extracted picks validation fails:

- fail the build or data-generation script
- do not deploy corrupted app-state JSON

## Security

v1 has no personal accounts.

Minimum rules:

- no provider secrets in browser code
- no FIFA cookies/tokens in repo
- no unprotected admin mutation endpoints
- no browser-exposed provider refresh control
- treat the app link as semi-private

Launch gate:

- unlisted deployment URL
- Vercel password protection
- simple shared-passphrase middleware

Choose one before sharing broadly. For the first private family test, an unlisted URL is acceptable if everyone understands it is not strong access control.

## Implementation Order

1. Scaffold Next.js with TypeScript.
2. Add schema validation for `data/family_bracket_picks.json`.
3. Build normalized app-state generation from local picks.
4. Add match provider adapter and saved fixtures.
5. Add `/api/data` and cached app-state storage.
6. Add `/api/cron/refresh` for provider refresh.
7. Render bracket, schedule, live score, and actual group views.
8. Deploy v1 with Vercel Cron and Blob/Redis.
9. Maintain scoring and leaderboard from `data/scoring_rules.json`.
