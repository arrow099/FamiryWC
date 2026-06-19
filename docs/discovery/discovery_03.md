# Discovery 03: App Data Structures and Schemas

Date: 2026-06-18

## Purpose

Define the data structures we plan to use in the Famiry World Cup fan app.

This builds on:

- `discovery_01.md`: the friend's app uses a static generated `data.json`
- `discovery_02.md`: match data should come from an API provider, while our family picks already exist in local HTML and were extracted into JSON

The goal is to keep the frontend simple while preserving enough structure for live matches, group standings, bracket picks, scoring, and rankings.

## Data Layers

Use three data layers:

```text
raw source data -> normalized domain data -> generated frontend app state
```

### 1. Raw Source Data

Raw inputs are source-specific and should be preserved for debugging.

Examples:

```text
FAMIRY2026_BracketDashboard.html
data/family_bracket_picks.json
runtime/raw/espn_scoreboard.json
```

Rules:

- Do not build the UI directly against raw third-party payloads.
- Do not mutate raw source snapshots.
- Keep provider-specific fields out of the frontend where possible.
- Preserve enough source metadata to trace where each generated value came from.

### 2. Normalized Domain Data

Normalized data is the app's internal model.

This layer should use stable objects such as:

- `Team`
- `Member`
- `Match`
- `GroupStanding`
- `PlayerPick`
- `KnockoutMatchPick`
- `LeaderboardEntry`
- `ScoringRule`

Provider adapters should map ESPN, future APIs, or manual data into this model.

### 3. Generated Frontend App State

The frontend should consume one generated file:

```text
public/data.json
```

This file should be complete enough for static hosting and browser polling.

The frontend should not need to call ESPN, FIFA, a database, or any external API directly.

## Existing Extracted Picks Schema

The current extracted picks file is:

```text
data/family_bracket_picks.json
```

Top-level shape:

```json
{
  "schemaVersion": 1,
  "source": {},
  "summary": {},
  "teams": [],
  "players": []
}
```

Confirmed extracted counts:

- 30 players
- 48 unique teams
- 12 groups
- Knockout rounds: `R32`, `R16`, `QF`, `SF`, `F`

### Extracted Source Metadata

```json
{
  "source": {
    "type": "static_html",
    "file": "FAMIRY2026_BracketDashboard.html",
    "extractedFrom": "const DATA",
    "extractedAt": "2026-06-18T00:00:00.000Z"
  }
}
```

This metadata records that the family picks came from the local static HTML file, not FIFA Bracket Challenge or another live integration.

### Extracted Team

```json
{
  "id": 1,
  "name": "Argentina",
  "abbr": "ARG"
}
```

For v1, `id` is the extracted local team ID from the bracket dashboard. If we later combine this with ESPN IDs, keep provider IDs separately instead of replacing this local ID.

Recommended normalized team shape:

```json
{
  "id": "team_arg",
  "name": "Argentina",
  "abbr": "ARG",
  "providerIds": {
    "local": 1,
    "espn": null,
    "fifa": null
  }
}
```

### Extracted Player Pick

Each player currently has:

```json
{
  "name": "Leppy27",
  "groupMap": {},
  "thirdPlace": [],
  "knockout": {}
}
```

Recommended normalized player shape:

```json
{
  "id": "member_leppy27",
  "displayName": "Leppy27",
  "sourceName": "Leppy27"
}
```

Recommended normalized pick shape:

```json
{
  "memberId": "member_leppy27",
  "source": "family_bracket_picks",
  "groups": {},
  "thirdPlaceAdvancers": [],
  "knockout": {}
}
```

Keep member identity separate from picks so we can rename display names later without changing scoring history.

## Group Pick Schema

The extracted `groupMap` is organized by group letter and finishing position:

```json
{
  "A": {
    "1": { "name": "Mexico", "abbr": "MEX", "id": 8 },
    "2": { "name": "Korea Republic", "abbr": "KOR", "id": 32 },
    "3": { "name": "Czechia", "abbr": "CZE", "id": 47 },
    "4": { "name": "South Africa", "abbr": "RSA", "id": 23 }
  }
}
```

For normalized app data, preserve the ranking order but use stable team IDs:

```json
{
  "groups": {
    "A": [
      { "position": 1, "teamId": "team_mex" },
      { "position": 2, "teamId": "team_kor" },
      { "position": 3, "teamId": "team_cze" },
      { "position": 4, "teamId": "team_rsa" }
    ]
  }
}
```

The generated frontend state can also include denormalized team names and abbreviations for easier rendering.

## Third-Place Pick Schema

The extracted `thirdPlace` array stores the eight third-place teams each player expects to advance:

```json
[
  { "name": "Scotland", "abbr": "SCO", "id": 43 },
  { "name": "Côte d'Ivoire", "abbr": "CIV", "id": 27 }
]
```

Normalized shape:

```json
{
  "thirdPlaceAdvancers": [
    "team_sco",
    "team_civ"
  ]
}
```

This keeps the player's selected teams distinct from the actual third-place advancement rules.

## Knockout Pick Schema

The extracted knockout structure is organized by round:

```json
{
  "R32": [
    {
      "team1": { "name": "Germany", "abbr": "GER", "id": 7 },
      "team2": { "name": "Paraguay", "abbr": "PAR", "id": 21 },
      "winner": { "name": "Germany", "abbr": "GER", "id": 7 },
      "bracketId": 1
    }
  ]
}
```

Recommended normalized shape:

```json
{
  "knockout": {
    "R32": [
      {
        "slotId": "R32-1",
        "round": "R32",
        "bracketId": 1,
        "team1Id": "team_ger",
        "team2Id": "team_par",
        "winnerId": "team_ger"
      }
    ]
  }
}
```

Round IDs:

```text
R32: Round of 32
R16: Round of 16
QF: Quarterfinal
SF: Semifinal
F: Final
```

Keep `bracketId` because it preserves the original bracket slot order from the static dashboard.

## Match Data Schema

Official/live match data should come from a provider adapter, initially ESPN.

Normalized match shape:

```json
{
  "id": "match_001",
  "providerIds": {
    "espn": "401000001"
  },
  "stage": "group",
  "round": "Group A",
  "group": "A",
  "kickoffAt": "2026-06-11T00:00:00.000Z",
  "status": "pre",
  "statusText": "Scheduled",
  "clock": null,
  "homeTeamId": "team_mex",
  "awayTeamId": "team_rsa",
  "homeScore": null,
  "awayScore": null,
  "winnerTeamId": null,
  "venue": {
    "name": null,
    "city": null,
    "country": null
  }
}
```

Allowed match statuses:

```text
pre
in
post
postponed
cancelled
unknown
```

The friend's app used `pre`, `in`, and `post`; we should support those plus fallback states.

## Actual Group Standing Schema

Actual standings are derived from match results, not from family picks.

```json
{
  "group": "A",
  "teams": [
    {
      "teamId": "team_mex",
      "played": 0,
      "won": 0,
      "drawn": 0,
      "lost": 0,
      "goalsFor": 0,
      "goalsAgainst": 0,
      "goalDifference": 0,
      "points": 0,
      "position": null,
      "qualified": false,
      "qualificationType": null
    }
  ]
}
```

Possible `qualificationType` values:

```text
group_winner
group_runner_up
third_place
eliminated
unknown
```

## Actual Bracket Schema

Actual bracket data should be generated from finished group standings and knockout match results.

```json
{
  "actualBracket": {
    "R32": [],
    "R16": [],
    "QF": [],
    "SF": [],
    "F": []
  }
}
```

Each actual bracket match should use the same slot shape as knockout picks, with extra fields for live score and status if needed.

```json
{
  "slotId": "R32-1",
  "round": "R32",
  "bracketId": 1,
  "matchId": "match_049",
  "team1Id": "team_ger",
  "team2Id": "team_par",
  "winnerId": null,
  "status": "pre"
}
```

## Scoring Schema

Scoring should be explicit and versioned.

Initial shape:

```json
{
  "scoringVersion": 1,
  "rules": {
    "groupExactPosition": 0,
    "groupQualified": 0,
    "thirdPlaceAdvanced": 0,
    "knockoutWinnerByRound": {
      "R32": 0,
      "R16": 0,
      "QF": 0,
      "SF": 0,
      "F": 0
    },
    "champion": 0
  }
}
```

The point values are intentionally `0` placeholders until we decide whether to copy FIFA Bracket Challenge scoring, define our own rules, or infer the family's intended rules from the original dashboard.

## Leaderboard Schema

Leaderboard entries should be generated, not hand-authored.

```json
{
  "rank": 1,
  "memberId": "member_leppy27",
  "displayName": "Leppy27",
  "totalPoints": 0,
  "groupPoints": 0,
  "thirdPlacePoints": 0,
  "knockoutPoints": 0,
  "championPick": "team_bra",
  "possiblePointsRemaining": null,
  "correctPicks": {
    "groups": 0,
    "thirdPlace": 0,
    "knockout": 0
  }
}
```

Use generated fields for display convenience, but keep the scoring engine based on normalized IDs.

## Generated Frontend `public/data.json`

The frontend should receive a complete generated app state:

```json
{
  "schemaVersion": 1,
  "capturedAt": "2026-06-18T00:00:00.000Z",
  "sources": {
    "picks": {
      "provider": "local_html_extract",
      "file": "data/family_bracket_picks.json"
    },
    "matches": {
      "provider": "espn",
      "fetchedAt": null
    }
  },
  "league": {
    "id": "famiry_2026",
    "name": "FAMIRY 2026",
    "memberCount": 30
  },
  "teams": [],
  "members": [],
  "matches": [],
  "groups": {},
  "actualBracket": {},
  "picks": [],
  "leaderboard": [],
  "scoring": {}
}
```

This mirrors the friend's static JSON approach while keeping our source-specific details behind a stable contract.

## File Plan

Recommended files for v1:

```text
data/family_bracket_picks.json
data/scoring_rules.json
runtime/raw/espn_scoreboard.json
public/data.json
```

Potential later split:

```text
data/teams.json
data/members.json
data/picks.json
data/matches_manual_overrides.json
```

Do not split the extracted picks too early. The current single JSON file is usable and preserves the original bracket dashboard data.

## Schema Decisions

- Use a generated `public/data.json` as the only frontend contract.
- Use stable internal IDs for teams, members, matches, and bracket slots.
- Preserve provider IDs under `providerIds`.
- Treat local extracted picks as v1 source of truth for family picks.
- Treat ESPN or another match provider as source of truth for live match state.
- Generate standings, actual bracket, scoring, and leaderboard from normalized inputs.
- Keep scoring versioned because rules may change before kickoff.
- Keep FIFA Bracket Challenge as optional future integration only.

## Open Questions

- What exact scoring rules should we use?
- Should member display names be cleaned up or preserved exactly from the extracted HTML?
- Should `teamId` be based on abbreviation, local numeric ID, or a generated slug?
- Should `public/data.json` include denormalized team objects inside matches and picks for easier rendering?
- Do we need a manual override file for match provider corrections?
- Should generated artifacts be committed, or should `public/data.json` be build output?
