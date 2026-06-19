# Discovery 01: Friend's World Cup Fan App

Source studied: https://d1kvqmbqordtyx.cloudfront.net/

Date: 2026-06-18

## Purpose

Record initial findings from inspecting a friend's World Cup fan app before building our own version.

The friend's app tracks:

- Live match scores
- Upcoming and past matches
- League standings between friends
- Full schedule
- Groups and picks
- Predicted and actual bracket views
- Bracket rankings and live scoring

## Confirmed Site Structure

The deployed site is a compact static web app:

- `index.html` contains the page markup, CSS, and JavaScript inline.
- `data.json` is the primary app data file.
- `flags.json` maps team abbreviations to flag display values.
- The browser polls `data.json` every 30 seconds.
- The site loads JetBrains Mono from Google Fonts.
- Hosting is Amazon S3 behind CloudFront.

The browser-side JavaScript fetches only:

```text
data.json?_=<current timestamp>
flags.json
```

No browser-side calls were found for FIFA, ESPN, Supabase, Firebase, GraphQL, or any other custom API.

## Confirmed Hosting Details

The site is served through CloudFront with S3 as the origin.

Observed headers:

- `server: AmazonS3`
- `x-cache: Miss from cloudfront`
- `content-type: text/html` for the page
- `content-type: application/json` for `data.json`
- `cache-control: public, max-age=30` for `data.json`

This supports the conclusion that the public app is static and receives live-ish updates through a periodically regenerated JSON artifact.

## Data Model Observed

The public `data.json` includes these top-level keys:

```text
actual
actualBracket
capturedAt
groupPicks
groupsComplete
groupsStarted
leaderboard
league
leagueId
liveGroups
matches
members
scoring
squadsLive
```

Example league metadata observed:

```text
league: Bicycle Kicks in stoppage time
leagueId: 24564
members: 17
capturedAt: 2026-06-16T22:15:11.384Z
groupsStarted: 12
groupsComplete: 0
```

The `matches` array contains the full tournament schedule and current state for matches. Observed match states:

```text
pre
in
post
```

Each match includes fields like:

```text
state
detail
clock
date
group
round
home.abbr
home.score
away.abbr
away.score
```

The `leaderboard` array contains each member's rank, score, group points, knockout points, champion pick, group predictions, knockout bracket picks, and derived scoring details.

The `groupPicks` object contains one entry per group from `A` through `L`. Each group includes current live team order, stats, and aggregated pick counts by predicted finishing position.

## Frontend Design Notes

The app has a simple but effective sports-terminal feel:

- Dark theme by default, with light theme through `prefers-color-scheme`.
- Monospace typography using JetBrains Mono.
- Dense tables instead of large marketing-style cards.
- Small tabs for major views:
  - `STANDINGS`
  - `SCHEDULE`
  - `GROUPS & PICKS`
  - `BRACKETS`
- Top live ticker for current and near-term matches.
- Hover tooltips for scoring explanations and pick details.
- Mobile behavior hides lower-priority columns to preserve standings readability.
- Bracket view supports member search and predicted vs actual bracket modes.

The UI is mostly plain JavaScript DOM rendering, with functions such as:

- `load`
- `render`
- `renderTicker`
- `renderSchedule`
- `renderStandings`
- `renderGroups`
- `renderBrackets`

## Important Inference

The deployed frontend does not reveal the upstream APIs. The likely architecture is:

```text
external data sources -> build.py or similar generator -> data.json + flags.json -> S3/CloudFront -> browser polling
```

This inference is based on:

- The lack of browser-side third-party API calls.
- The presence of static JSON files.
- The `data.json` cache window of 30 seconds.
- An inline JavaScript comment mentioning that `build.py` emits actual bracket tie order.

The upstream data sources may include a bracket challenge platform for user picks and a soccer scoreboard provider for live matches, but those source URLs are not exposed in the client.

## Implications For Our App

For our first version, we can copy the architecture pattern without copying implementation:

1. Keep the public frontend simple and static.
2. Define a single app-state JSON contract for the UI.
3. Build or schedule a backend/data job that refreshes that JSON.
4. Poll the JSON from the frontend every 30 seconds during active matches.
5. Keep league/member picks, match state, scoring, standings, groups, and bracket state normalized in that JSON.

This gives us a low-complexity deployment model:

```text
static frontend + generated JSON data
```

We can later decide whether the generator should pull from official APIs, a manually maintained admin tool, scraped sources, or an internal database.

## Open Questions

- What source should we use for official World Cup live match data?
- Where will our family/friend picks be entered and stored?
- Do we want account login, invite codes, or a private admin-managed league?
- Should the app be static-readonly at first, with picks entered manually before the tournament?
- Should our first milestone reproduce the friend's static JSON architecture before adding a database?
