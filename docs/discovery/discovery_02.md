# Discovery 02: Data Source Strategy

Date: 2026-06-18

## Purpose

Decide how we should source match data for our World Cup fan app:

- Use an API
- Scrape a website
- Maintain data manually
- Combine these approaches behind our own generated `data.json`

This builds on `discovery_01.md`, where we learned that the friend's app exposes only static JSON to the browser and likely refreshes that JSON from a private generator script.

Update: this repo already contains a static HTML representation of our family's bracket picks:

```text
FAMIRY2026_BracketDashboard.html
```

That HTML embeds the family picks in a JavaScript `const DATA = [...]` array. We extracted that array into:

```text
data/family_bracket_picks.json
```

So v1 does not need FIFA Bracket Challenge access to recover family picks. The HTML-derived JSON should be treated as our initial picks source of truth.

## Recommendation

Use an API-first approach for match data, not scraping.

Our first version should use this architecture:

```text
match data source -> normalizer script -> public/data.json -> frontend polling
family picks/admin data -> local JSON or database -> same public/data.json
```

For the first implementation, the best pragmatic source appears to be ESPN's public soccer scoreboard JSON endpoint for FIFA World Cup data.

Candidate endpoint:

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```

Observed response includes:

- League metadata for `FIFA World Cup`
- 2026 season metadata
- Tournament calendar entries
- Match/event IDs
- Match dates
- Match status
- Live clock and display clock
- Home/away teams
- Scores
- Venue
- Broadcasts
- Match statistics
- Goal and card event details

This is close to the data shape we saw in the friend's app:

```text
state: pre | in | post
detail: FT / Scheduled / live status text
clock
date
round
home.abbr
home.score
away.abbr
away.score
```

## Why API-First

APIs give us structured data and reduce fragile parsing.

For our use case, we need:

- Schedule
- Live score
- Match status
- Match clock
- Final score
- Team abbreviations
- Group and knockout phase labels
- Enough data to compute standings and bracket progression

An API-like JSON source is much easier to normalize than HTML pages.

Scraping should be treated as a fallback only because:

- Page markup can change without warning.
- Anti-bot and caching behavior can break refresh jobs.
- Scraping may violate site terms.
- HTML parsing is more fragile than JSON parsing.
- We need reliability during live matches, exactly when fragile scraping is most painful.

## Candidate Sources

### 1. ESPN Scoreboard JSON

Status: recommended for first prototype.

Pros:

- No browser scraping required.
- Public JSON shape is easy to inspect.
- No API key observed for the scoreboard endpoint.
- Includes live and final status fields.
- Includes match IDs, teams, scores, venues, broadcasts, and detailed match events.
- Closely matches the friend's observed `matches` schema.

Cons:

- It is not a formally contracted API for our app.
- Endpoint behavior could change.
- Terms and long-term reliability need review before relying on it for a public product.
- We may need to derive group standings ourselves from match results.

Planned use:

```text
scripts/fetch_espn_scoreboard.py
scripts/build_data.py
public/data.json
```

The frontend should never call ESPN directly. Our backend/generator should call ESPN, normalize the response, and emit our stable app contract.

### 2. football-data.org

Status: possible fallback or paid/registered option.

Observed documentation shows FIFA World Cup as competition code `WC` and API examples for:

- Competitions
- Teams for a competition
- Matches
- Match filters by competition and status

Pros:

- More intentionally API-shaped than scraping.
- Has documented endpoints.
- Uses stable football domain objects.

Cons:

- Requires registration/API token.
- World Cup access may depend on tier.
- Live freshness and exact 2026 coverage need verification with an API key.
- We need to check whether its free tier is enough for live match tracking.

### 3. Sportmonks Football API

Status: commercial candidate if we want a supported provider.

Their docs include a dedicated World Cup 2026 section and live matches/livescores guidance.

Pros:

- Commercial football data provider.
- Dedicated documentation for World Cup application building.
- Likely stronger support and coverage than unofficial endpoints.

Cons:

- Requires account and likely paid plan for useful live coverage.
- More setup than the ESPN prototype path.
- We should not commit to it until we know budget and usage limits.

### 4. Sportradar Soccer API

Status: enterprise-grade candidate, likely overkill for v1.

Pros:

- Professional sports data provider.
- Strong reliability expectations.
- Suitable if the app becomes serious or public-facing.

Cons:

- Likely commercial/enterprise pricing.
- More integration overhead.
- Too heavy for a family/friends app unless we need guaranteed data rights and support.

### 5. FIFA Website Scraping

Status: avoid for v1.

Pros:

- Official source in a human sense.
- Could be useful for manual cross-checking.

Cons:

- No clean official public API was identified for our app use.
- Scraping HTML or hidden web payloads can be brittle.
- Terms and anti-bot risks are higher.
- Live match reliability is uncertain.

If we use FIFA data at all in v1, it should be as a manual verification source, not the primary automation source.

### 6. FIFA World Cup Bracket Challenge / FIFA Play Zone

Status: useful research target, but not a primary v1 data source.

FIFA Play Zone does include a bracket game in its public compiled app bundle. The app registry names it `BRACKET_PREDICTOR`, and the bundle references routes for:

- `/brackets`
- `/second-chance`
- `/another-brackets/:userId`
- `/another-brackets-second-chance/:userId`
- `/rankings`
- `/leagues`
- `/leagues/create`
- `/leagues/join`
- `/leagues/:id/table`
- `/leagues/:id/invites`
- `/leagues/:id/about`
- `/leagues/:id/settings`
- `/join-league/:code`

The bracket predictor bundle also references endpoint families for predictions, scoring, other users' predictions, after-lockout predictions, league views, and static bracket metadata. The clearest relative paths observed were:

```text
predictions
predictions/delete-all
predictions/autopick-free
predictions/group/{group}/autopick-free-based-on-popularity
ranking/scoring
after-lockout-predictions
after-lockout-predictions/delete-all
after-lockout-predictions/autopick-free
after-lockout-predictions/ranking/scoring
user/{userId}/predictions
user/{userId}/after-lockout-predictions
bracket_predictor/rounds.json
bracket_predictor/squads.json
bracket_predictor/checksums.json
bracket_predictor/squadStats.json
```

The static metadata paths are promising because they suggest FIFA maintains structured bracket data for rounds, teams, checksums, and squad stats. However, direct probes at `https://play.fifa.com/bracket_predictor/*.json` returned 404 responses, so the actual base URL is not resolved yet. The public bundles also reference FIFA API and auth hosts such as:

```text
https://api.fifa.com/
https://auth.fifa.com/
https://play.fifa.com/
```

This means the FIFA bracket app is not a clean public API we can depend on yet. It is more likely an authenticated web application with internal APIs. Pulling private league rankings, member picks, or friend bracket data probably requires a logged-in FIFA account and session cookies.

Pros:

- It is the official bracket challenge product.
- It likely has the exact bracket structure and scoring model users already know.
- It may expose existing league tables, member brackets, and scoring data after login.
- It could be useful for importing picks if our family already uses FIFA's bracket game.

Cons:

- No documented public API was identified.
- League and user-prediction data appears auth-gated.
- Automating against internal web app endpoints may violate FIFA terms.
- Session cookies or auth tokens must never be committed to the repo.
- The app could change bundle names, route behavior, or payload schemas without notice.

Recommendation:

Do not build v1 around FIFA Bracket Challenge data. We already have the family's picks locally in `FAMIRY2026_BracketDashboard.html`, now extracted to `data/family_bracket_picks.json`. Keep FIFA Bracket Challenge as an optional import or validation path after we confirm access and terms.

If we decide to continue exploring it, the next safe research steps are:

1. Use a real browser with a FIFA account and a test league.
2. Watch network requests for `/leagues/:id/table`, `/another-brackets/:userId`, `/rankings`, and `/brackets`.
3. Confirm whether league/member prediction data can be exported with user consent.
4. Document exact request URLs and response shapes without saving credentials.
5. Add a provider adapter only if terms and access are acceptable.

For now, FIFA Bracket Challenge should influence our domain model and scoring research only where useful. The local extracted picks JSON should supply family picks, and ESPN or another sports-data API should remain the automated match-data source.

## Picks Data Is Our Data

Match data and family picks should be separate concerns.

We should not depend on a third-party bracket challenge platform for family picks unless we intentionally integrate one later. The static HTML in this repo already contains the family bracket picks, so our immediate job is to normalize and reuse that data.

For v1, start from the extracted JSON:

```text
data/family_bracket_picks.json
```

The extracted file contains:

- `summary.playerCount`: 30
- `summary.uniqueTeamCount`: 48
- `summary.championPickCounts`
- `teams`
- `players`
- Per-player `groupMap`, `thirdPlace`, and `knockout` picks

As the app grows, we can split this into smaller editable source files if needed:

```text
data/members.json
data/picks.json
data/scoring_rules.json
```

Then generate:

```text
public/data.json
```

This keeps the frontend simple and lets us change match providers without rewriting the UI.

## Proposed Internal Data Contract

The frontend should consume only our own normalized app state:

```json
{
  "capturedAt": "2026-06-18T00:00:00.000Z",
  "source": {
    "provider": "espn",
    "fetchedAt": "2026-06-18T00:00:00.000Z"
  },
  "league": {
    "name": "Famiry World Cup",
    "members": 0
  },
  "matches": [],
  "groups": {},
  "members": [],
  "picks": [],
  "leaderboard": [],
  "bracket": {
    "actual": null
  }
}
```

This mirrors the friend's static JSON pattern but keeps the provider hidden behind our own contract.

## First Implementation Plan

1. Build a small ESPN fetch probe.
2. Save raw responses under an ignored runtime folder for inspection.
3. Create a normalizer that maps ESPN events into our `matches` schema.
4. Use `data/family_bracket_picks.json` as the initial family picks source.
5. Generate `public/data.json`.
6. Build the frontend against `public/data.json` only.
7. Add editable member/pick source files later if the extracted JSON becomes too bulky.
8. Add a provider switch later if ESPN is insufficient.

## Scraping Policy

Scraping is allowed only as a fallback, not the default.

Use scraping only if:

- No usable API source exists for a required field.
- The scraped source is legally acceptable for our use.
- The scraper is isolated behind the same normalizer interface.
- The app can continue to run with stale data if scraping fails.

Do not build frontend code that scrapes or calls third-party sites directly.

## Current Decision

Use ESPN scoreboard JSON as the first prototype data source.

Keep the architecture provider-neutral:

```text
provider fetcher -> normalizer -> generated app JSON -> frontend
```

Do not scrape for v1 unless the ESPN feed fails to provide a critical field.

Do not store family picks in an external bracket platform for v1. Own the pick data locally first, starting with `data/family_bracket_picks.json`, then decide later whether we need accounts, forms, an admin dashboard, or an optional FIFA Bracket Challenge importer.

FIFA Bracket Challenge is not rejected, but it should be treated as a secondary integration candidate. It may be valuable later for sync or validation, but we no longer need it to recover the current family picks.

## Sources Reviewed

- Friend app: https://d1kvqmbqordtyx.cloudfront.net/
- Friend app data: https://d1kvqmbqordtyx.cloudfront.net/data.json
- Local static bracket dashboard: `FAMIRY2026_BracketDashboard.html`
- Extracted local family picks: `data/family_bracket_picks.json`
- ESPN FIFA World Cup scoreboard JSON: https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
- football-data.org API documentation: https://www.football-data.org/documentation/quickstart
- Sportmonks Football API docs: https://docs.sportmonks.com/v3
- Sportradar Soccer API docs: https://developer.sportradar.com/soccer/reference/soccer-overview
- FIFA Play Zone: https://play.fifa.com/
- FIFA Play Zone app bundle: https://play.fifa.com/static/js/index-BZCKCUL0.js
- FIFA Bracket Predictor app bundle: https://play.fifa.com/static/js/index-Db_TUdI7.js
- FIFA Play Zone components bundle: https://play.fifa.com/components/main.bundle.js
