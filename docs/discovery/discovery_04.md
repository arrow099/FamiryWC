# Discovery 04: Small-App Architecture

Date: 2026-06-18

## Purpose

Design the architecture for a small World Cup fan app used by about 30 people.

The user preference is to use Next.js. The architecture should stay intentionally simple and avoid infrastructure that would only make sense for a large public app.

This builds on:

- `discovery_01.md`: the friend's app succeeds with static frontend plus generated JSON
- `discovery_02.md`: ESPN-style match data source, local family picks source
- `discovery_03.md`: normalized data model and generated frontend `public/data.json`

## Recommendation

Use Next.js as the app framework, but keep the data architecture close to the friend's proven static JSON model.

Recommended shape:

```text
local source data + match provider fetcher
        |
        v
server-side build/generation code
        |
        v
public/data.json or server route JSON
        |
        v
Next.js UI
```

For v1, this should be mostly file-backed:

```text
data/family_bracket_picks.json
data/scoring_rules.json
runtime/raw/espn_scoreboard.json
public/data.json
```

Do not introduce a database until we have a real need for live editing, authentication, audit trails, or multi-league support.

## Architecture Goals

- Serve 30 family/friend users reliably.
- Keep the app easy to deploy and reason about.
- Use our extracted bracket picks as the initial source of truth.
- Fetch or refresh live match data behind a server-side boundary.
- Keep ESPN/FIFA/provider-specific details out of React components.
- Keep the frontend render contract stable.
- Make it possible to deploy cheaply on Vercel or any Node-capable host.
- Avoid account/login complexity for v1 unless family pick editing becomes necessary.

## Proposed Stack

### Framework

Use Next.js with the App Router.

Recommended defaults:

```text
Next.js
React
TypeScript
CSS Modules or Tailwind
Node runtime for data scripts
```

TypeScript is worth using even for a small app because the app is data-shape heavy. Most risk is not UI complexity; it is mismatched team IDs, bracket slots, scoring rules, and provider payloads.

### Styling

Keep styling simple.

Good options:

- CSS Modules for explicit, local styles
- Tailwind if we want fast iteration and utility classes

Avoid a heavy component library for v1. This app needs dense sports tables, tabs, selectors, and bracket views more than complex enterprise UI components.

### Data Store

Use local JSON files first.

```text
data/family_bracket_picks.json
data/scoring_rules.json
```

This is enough because:

- The user base is small.
- Picks already exist.
- Picks do not need constant editing.
- The app can be rebuilt or refreshed from source files.
- The frontend can remain static-ish and fast.

### Match Data Provider

Use a server-side provider adapter.

Initial provider:

```text
ESPN scoreboard JSON
```

The browser should not call ESPN directly. Next.js server code or a build script should fetch provider data, normalize it, and emit our internal contract.

## Recommended Project Structure

```text
app/
  layout.tsx
  page.tsx
  standings/page.tsx
  schedule/page.tsx
  groups/page.tsx
  brackets/page.tsx
  api/
    data/route.ts
components/
  AppShell.tsx
  LiveTicker.tsx
  StandingsTable.tsx
  ScheduleTable.tsx
  GroupPicksView.tsx
  BracketView.tsx
  MemberSelector.tsx
lib/
  appData/
    buildAppData.ts
    loadFamilyPicks.ts
    normalizePicks.ts
    scoreLeaderboard.ts
  providers/
    espn.ts
  schemas/
    appData.ts
    picks.ts
    scoring.ts
data/
  family_bracket_picks.json
  scoring_rules.json
public/
  data.json
scripts/
  build-data.ts
  fetch-espn.ts
runtime/
  raw/
```

For the first implementation, we can use fewer files than this. The structure above is the direction, not a requirement to scaffold every module immediately.

## Data Flow

### Build-Time or Scheduled Refresh Flow

```text
1. Load data/family_bracket_picks.json
2. Load data/scoring_rules.json
3. Fetch match data from ESPN provider
4. Normalize teams, matches, picks, groups, and bracket slots
5. Compute actual standings and actual bracket state
6. Score each member's picks
7. Write public/data.json
8. Next.js UI renders from public/data.json
```

This best matches the friend's app and is operationally simple.

### Runtime API Flow

Next.js can also expose:

```text
GET /api/data
```

That route can return the same app-state shape as `public/data.json`.

Use this route if we want:

- fresh data without committing/generated public files
- host-managed cache headers
- server-side provider fetches at request time
- a simple admin refresh endpoint later

For v1, prefer generated `public/data.json` unless deployment makes route-based refresh easier.

## Rendering Model

Use mostly client-side rendering from the generated app state.

The app is interactive in ways that are easier client-side:

- member selector
- bracket comparison
- tabs
- group-pick heatmaps
- live polling
- filtering schedule by group/round/status

Recommended pattern:

```text
Next.js page shell -> client component fetches /data.json or /api/data -> render views
```

The first page can be server-rendered for layout, but the core dashboard can be a client component because this is a private family app, not an SEO-driven site.

## Polling and Freshness

During live match windows, the client can poll every 30 seconds, copying the friend's app pattern.

```text
GET /data.json?ts=<current timestamp>
```

or:

```text
GET /api/data
```

Freshness fields should be visible in the app state:

```json
{
  "capturedAt": "2026-06-18T00:00:00.000Z",
  "sources": {
    "matches": {
      "provider": "espn",
      "fetchedAt": "2026-06-18T00:00:00.000Z"
    },
    "picks": {
      "provider": "local_html_extract",
      "file": "data/family_bracket_picks.json"
    }
  }
}
```

## Deployment Options

### Option A: Vercel

Status: recommended if we want the easiest Next.js deployment.

Pros:

- First-class Next.js support.
- Easy preview deployments.
- Route handlers and scheduled jobs are available depending on plan/features.
- Good enough for 30 users.

Cons:

- Need to be clear about how `public/data.json` gets refreshed.
- Scheduled provider fetches may require Vercel cron or an external trigger.

### Option B: Static Export

Status: possible if live updates are generated externally.

Pros:

- Very cheap and simple hosting.
- Similar to the friend's CloudFront/S3 model.

Cons:

- Next.js API routes are not available.
- Live data refresh requires a separate script/job that uploads `data.json`.

### Option C: Small Node Server

Status: acceptable if we want full control.

Pros:

- Next.js route handlers can fetch and cache data server-side.
- Easy local cron or process-managed refresh.

Cons:

- More server maintenance than Vercel.
- Overkill unless Vercel constraints become annoying.

## Recommended Deployment Decision

Start with Vercel and generated or route-served JSON.

Use this decision path:

```text
If public/data.json refresh during deploy is enough:
  use generated public/data.json

If data must refresh while deployed:
  use /api/data with short cache or Vercel cron to regenerate data

If Vercel constraints block us:
  move the same Next.js app to a small Node host
```

Do not start with a database or custom backend service.

## Caching Strategy

For `public/data.json`:

```text
cache-control: public, max-age=30
```

For `/api/data`:

```text
cache-control: s-maxage=30, stale-while-revalidate=60
```

The exact headers can be tuned later. The important part is that live data is allowed to be slightly stale, and the UI always shows `capturedAt`.

## Admin and Editing

No admin UI is needed for v1.

Initial picks already exist in:

```text
data/family_bracket_picks.json
```

If we need edits before kickoff, use a controlled JSON edit or a small script first.

Add admin UI only when we need one of these:

- family members entering picks themselves
- post-submission corrections
- multiple leagues
- private invite links
- scoring rule changes from the browser

If admin UI is added later, then consider a database.

## Database Decision

Do not use a database for v1.

Reasons:

- 30 users is small.
- Picks are already captured.
- Generated JSON is easy to inspect and debug.
- The app is mostly read-only.
- A database adds auth, migrations, backups, and operational complexity.

Possible future database options:

- SQLite for simple self-hosted persistence
- Turso/LibSQL for hosted SQLite
- Supabase Postgres if we need accounts and richer admin workflows

The first database-worthy feature is not viewing standings; it is authenticated editing.

## Security and Privacy

For v1:

- Do not store FIFA cookies, tokens, or session data.
- Do not expose provider credentials to the browser.
- Do not include private admin endpoints without protection.
- Treat family display names as public within the app link.
- Avoid collecting email/password accounts unless necessary.

If the deployed app should be semi-private, use one of:

- unlisted URL only
- Vercel password protection if available
- simple middleware gate with a shared passphrase

Do not build full authentication until the product actually needs personal accounts.

## Failure Modes

The app should still work if match data refresh fails.

Expected behavior:

- Keep showing the last successful `public/data.json`.
- Show `capturedAt` and match provider `fetchedAt`.
- Mark source freshness as stale if data is old.
- Do not erase picks, leaderboard, or bracket views because a provider request failed.

Data generation should fail loudly in logs but preserve the previous good output when possible.

## Testing Strategy

Small but useful tests:

- JSON schema validation for `data/family_bracket_picks.json`
- normalization tests for teams, members, group picks, and knockout picks
- scoring tests once rules are defined
- provider adapter tests using saved ESPN fixture JSON
- smoke test that `buildAppData` emits valid `public/data.json`

The most important tests are data-shape and scoring tests, not snapshot tests of the UI.

## First Implementation Milestone

Milestone 1 should produce a read-only Next.js app.

Scope:

1. Scaffold Next.js with TypeScript.
2. Load `data/family_bracket_picks.json`.
3. Normalize teams, members, and picks.
4. Generate an app-state object.
5. Render the main dashboard views:
   - Overview
   - Groups
   - Third-place picks
   - Knockout brackets
   - Champion pick summary
6. Add placeholder match/schedule sections if live match data is not wired yet.

Do not block the first milestone on ESPN integration. The extracted picks are already enough to build useful screens.

## Later Milestones

### Milestone 2: Match Data

- Add ESPN fetcher.
- Save raw fixture response.
- Normalize schedule and match statuses.
- Add schedule and live ticker views.

### Milestone 3: Scoring

- Decide scoring rules.
- Compute actual standings and bracket outcomes.
- Generate leaderboard.
- Add scoring breakdown UI.

### Milestone 4: Refresh and Deploy

- Deploy to Vercel.
- Decide `public/data.json` versus `/api/data`.
- Add polling and freshness display.
- Add a refresh workflow for match data.

### Milestone 5: Optional Editing

- Add small admin flow only if needed.
- Revisit database decision only at this point.

## Current Architecture Decision

Use Next.js with TypeScript for the app, but keep the backend/data model file-based for v1.

The main contract remains:

```text
source data -> normalizer/scorer -> generated app state -> Next.js UI
```

This is the right level of complexity for a 30-person family app: modern enough to build a good UI, but simple enough that data stays inspectable and deployment stays cheap.
