# Data Model: Famiry World Cup v1

Date: 2026-06-18

## Purpose

Define the v1 data model used by the Next.js app.

The main rule is that React components consume one normalized app-state shape. Raw extracted picks and raw provider responses stay behind the data-generation layer.

## Source Files

Current required source file:

```text
data/family_bracket_picks.json
```

Planned source file:

```text
data/scoring_rules.json
```

Runtime frontend inputs:

```text
server-rendered StaticAppData
browser-resident Match[]
```

## Source Pick Data

The extracted family picks have this top-level shape:

```json
{
  "schemaVersion": 1,
  "source": {},
  "summary": {},
  "teams": [],
  "players": []
}
```

Confirmed source counts:

- 30 players
- 48 teams
- 12 groups
- 5 knockout rounds: `R32`, `R16`, `QF`, `SF`, `F`

Raw source metadata:

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

Raw source summary includes generated convenience fields:

```json
{
  "summary": {
    "playerCount": 30,
    "groupCount": 12,
    "rounds": ["R32", "R16", "QF", "SF", "F"],
    "uniqueTeamCount": 48,
    "championPickCounts": {},
    "championPickPlayers": {}
  }
}
```

Raw source team shape:

```json
{
  "id": 1,
  "name": "Argentina",
  "abbr": "ARG"
}
```

The source `players` array contains embedded team objects:

```json
{
  "name": "Leppy27",
  "groupMap": {
    "A": {
      "1": { "name": "Mexico", "abbr": "MEX", "id": 8 }
    }
  },
  "thirdPlace": [
    { "name": "Scotland", "abbr": "SCO", "id": 43 }
  ],
  "knockout": {
    "R32": [
      {
        "team1": { "name": "Germany", "abbr": "GER", "id": 7 },
        "team2": { "name": "Paraguay", "abbr": "PAR", "id": 21 },
        "winner": { "name": "Germany", "abbr": "GER", "id": 7 },
        "bracketId": 1
      }
    ]
  }
}
```

## App State

The generated app-state contract should look like:

```json
{
  "schemaVersion": 1,
  "capturedAt": "2026-06-18T00:00:00.000Z",
  "sources": {},
  "league": {},
  "teams": [],
  "members": [],
  "picks": [],
  "matches": [],
  "groups": {},
  "actualBracket": {},
  "leaderboard": [],
  "scoring": {}
}
```

This is the only shape the frontend should need.

## IDs

Use stable string IDs internally.

Canonical generators:

```text
team_${abbr.toLowerCase()}
member_${slug(trim(sourceName))}
match_001
R32-1
```

Examples:

```text
team_arg
team_bra
member_leppy27
```

Keep external IDs separately:

```json
{
  "providerIds": {
    "local": 1,
    "espn": null,
    "fifa": null
  }
}
```

Do not use ESPN or FIFA IDs as primary app IDs.

If two members normalize to the same slug, append a numeric suffix in source order:

```text
member_john
member_john_2
```

## Team

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

## Member

```json
{
  "id": "member_leppy27",
  "displayName": "Leppy27",
  "sourceName": "Leppy27"
}
```

`sourceName` preserves the original extracted value. `displayName` is the UI-safe version.

Name policy:

- `sourceName` preserves the exact raw extracted text.
- `displayName` trims leading/trailing whitespace for UI display.
- `memberId` derives from trimmed `sourceName`.
- any duplicate member slug gets a deterministic numeric suffix.

## Pick

```json
{
  "memberId": "member_leppy27",
  "groups": {},
  "thirdPlaceAdvancers": [],
  "knockout": {},
  "championPick": "team_bra"
}
```

`championPick` is derived from `knockout.F[0].winnerId`. If stored in generated app state, it must equal the final-round winner.

## Group Picks

```json
{
  "A": [
    { "position": 1, "teamId": "team_mex" },
    { "position": 2, "teamId": "team_kor" },
    { "position": 3, "teamId": "team_cze" },
    { "position": 4, "teamId": "team_rsa" }
  ]
}
```

## Third-Place Picks

```json
{
  "thirdPlaceAdvancers": [
    "team_sco",
    "team_civ"
  ]
}
```

## Knockout Picks

```json
{
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
```

Valid rounds:

```text
R32
R16
QF
SF
F
```

## Match

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

Valid statuses:

```text
pre
in
post
postponed
cancelled
unknown
```

## Group Standings

Actual standings are generated from match results.

```json
{
  "A": [
    {
      "teamId": "team_mex",
      "position": 1,
      "played": 3,
      "won": 2,
      "drawn": 1,
      "lost": 0,
      "goalsFor": 5,
      "goalsAgainst": 2,
      "goalDifference": 3,
      "points": 7,
      "qualified": true,
      "qualificationType": "group_winner"
    }
  ]
}
```

Valid qualification types:

```text
group_winner
group_runner_up
third_place
eliminated
unknown
```

## Actual Bracket

```json
{
  "R32": [
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
  ]
}
```

## Scoring

Scoring should be versioned.

Active v2 rules:

```json
{
  "scoringVersion": 2,
  "rules": {
    "groupExactPosition": 50,
    "groupExactBonus": 30,
    "knockoutAdvancementByRound": {
      "R32": 20,
      "R16": 30,
      "QF": 40,
      "SF": 75,
      "F": 100
    }
  }
}
```

Point values live in `data/scoring_rules.json`.
Group points use the current standings, so they remain provisional until the group
stage is complete. The exact-group bonus applies whenever all four current positions
match the prediction.
The knockout keys identify the match whose winner reaches the scored stage: an
`R32` winner reaches the Round of 16, while an `F` winner is the champion.

## Leaderboard Entry

```json
{
  "rank": 1,
  "memberId": "member_leppy27",
  "displayName": "Leppy27",
  "totalPoints": 0,
  "groupPoints": 0,
  "knockoutPoints": 0,
  "knockoutPointsByRound": {
    "R32": 0,
    "R16": 0,
    "QF": 0,
    "SF": 0,
    "F": 0
  },
  "championPick": "team_bra",
  "possiblePointsRemaining": null,
  "correctPicks": {
    "groups": 0,
    "knockout": 0
  }
}
```

Leaderboard entries are generated. They should not be manually edited.

## Validation Rules

Minimum validation:

- every player has `name`, `groupMap`, `thirdPlace`, and `knockout`
- every player has exactly groups `A` through `L`
- every group has exactly positions `1` through `4`
- every group has four ranked teams with no duplicate team IDs inside that group
- embedded team objects in group, third-place, and knockout picks match the canonical `teams` table by local source ID, name, and abbreviation
- each third-place pick has eight teams
- each third-place pick list has no duplicate team IDs
- each knockout round has the expected number of matches
- every knockout winner is one of the two match teams
- each player's R32 has 32 team slots and no duplicate team IDs
- every referenced team exists in `teams`
- generated member IDs are unique
- generated team IDs are unique

Expected knockout counts:

```text
R32: 16
R16: 8
QF: 4
SF: 2
F: 1
```

Historical extracted-data correction:

- `Arrow06` originally had duplicate local team ID `21` in R32 slot 7. We corrected that slot to Bosnia-Herzegovina (`BIH`, local ID `24`) so the R32 field now has 32 unique team slots. Validation should continue to report any future bracket-slot mistakes instead of silently accepting them.

## Denormalization

The app-state file may include denormalized names and abbreviations inside display-focused structures if it keeps React components simple.

The scoring engine should use IDs, not names.

## Open Data Questions

- Should provider fixtures be committed under test fixtures or ignored under `runtime/raw/`?
