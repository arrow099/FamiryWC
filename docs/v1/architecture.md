# Architecture: Famiry World Cup v1

Date: 2026-06-19

## Decision

Use Next.js, TypeScript, React, and Material UI with a client-side live-data pipeline. Stable family picks are validated and normalized while rendering the page. Each visible browser polls ESPN directly every 30 seconds and keeps normalized matches in memory.

There is no v1 database, server API, scheduled job, Vercel Blob store, or persistent live-data cache.

```text
stable JSON picks -> server-rendered StaticAppData -> dashboard

visible browser -> ESPN scoreboard -> normalize matches -> in-memory snapshot
                                                       |
                                                       +-> header / overview / schedule
                                                       +-> lazy leaderboard derivation
```

## Data Boundaries

Stable data:

- teams, participants, and submitted picks
- scoring rules and league metadata
- validated once when the page is rendered

Live data:

- schedule, match status, scores, clocks, and winners
- fetched and normalized in the browser
- retained only for the current page session

Derived data:

- group standings, actual knockout results, and leaderboard scores
- computed from stable picks plus the current match snapshot
- built only while the Leaderboard tab is active

React components do not receive raw ESPN payloads. `lib/providers/espn.ts` remains the provider boundary and converts the response to the app's `Match` contract.

## Polling Lifecycle

The dashboard:

1. Renders stable picks immediately.
2. Fetches ESPN once after mounting.
3. Polls every 30 seconds while `document.visibilityState` is `visible`.
4. Stops the interval while hidden.
5. Refreshes immediately on visibility restoration, window focus, or network reconnect.
6. Prevents overlapping requests and aborts an active request when unmounted.

A successful response replaces the normalized match snapshot atomically. A failed response keeps the last successful in-memory snapshot, marks it stale, and displays a warning. If the first request fails, static tabs remain usable with no live matches or scores.

## Tab-Level Work

- Overview and Schedule read normalized matches directly.
- Participants, Groups, Knockout, and Compare use stable picks and do not aggregate live results.
- Leaderboard invokes group standings, actual bracket, and scoring derivation through a memoized calculation.
- Switching away from Leaderboard removes the derived result from the dashboard state; returning recomputes only when required.

All transformations are immutable. Polling replaces snapshots rather than mutating data used by a mounted tab.

## Provider and Scaling Tradeoffs

The ESPN scoreboard currently allows browser cross-origin requests. This endpoint is not a contracted API, so CORS policy or payload shape can change without notice.

Every visible browser is an independent poller. At a 30-second interval, one continuously visible client can make 120 requests per hour. The expected family-sized audience makes this acceptable for v1, but the architecture should return to a shared cache or managed backend if provider limits, reliability, or audience size become material.

## Deployment

Vercel builds and serves the Next.js app and creates previews for pushed branches. The application does not require runtime environment variables for ESPN, cron, or Blob.

The production checks are:

- static picks validate during the production build
- the browser can reach ESPN from the deployed origin
- polling pauses and resumes with page visibility
- provider failure leaves static bracket views operational

## Security

No secret is shipped to the browser. The ESPN URL is public and embedded in client code. Existing Vercel environment values may remain for older branches, but this branch does not read them.
