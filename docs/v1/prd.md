# PRD: Famiry World Cup v1

Date: 2026-06-18

## Overview

Famiry World Cup v1 is a small fan app for a 30-person family/friend World Cup bracket challenge.

The app should let members view everyone's bracket picks, compare predictions, and follow live tournament status.

The first version must include both the existing family bracket picks and live match data.

## Goals

- Build a polished read-only bracket dashboard.
- Use the extracted family picks as the source of truth.
- Support 30 known players and 48 World Cup teams.
- Show group-stage picks, third-place advancer picks, knockout brackets, finalists, and champion picks.
- Show schedule, live scores, match status, and provider freshness.
- Generate actual group standings and actual bracket state when enough match data exists.
- Score picks and show a leaderboard from actual match results using the active v1 scoring rules.
- Keep deployment and operations simple.

## Non-Goals

- No account system in v1.
- No public user registration.
- No database in v1.
- No user-submitted pick editing in v1.
- No dependency on FIFA Bracket Challenge for v1 picks.
- No database, scheduled refresh job, or persistent live-data store.
- No user-facing admin editor in v1.

## Users

Primary users:

- Family and friends participating in the bracket challenge.

Admin/operator:

- One repo maintainer who can update JSON files, scoring rules, and deployment settings.

## Core User Stories

- As a participant, I can see the overall bracket challenge summary.
- As a participant, I can compare every player's group picks by group and position.
- As a participant, I can select a family member and view their third-place advancer picks.
- As a participant, I can select a family member and view their knockout bracket.
- As a participant, I can see which teams were most often picked as champion.
- As a participant, I can compare two players' picks.
- As a participant, I can see the tournament schedule.
- As a participant, I can see live match scores and match status.
- As a participant, I can see actual group standings as results come in.
- As a participant, I can see whether the match data is fresh or stale.

## Tournament Format Assumptions

v1 assumes the 2026 48-team World Cup format represented in the extracted family bracket data:

- 12 groups: `A` through `L`
- 4 teams per group
- top 2 teams from each group advance
- 8 third-place teams advance
- 32-team knockout bracket
- knockout rounds: `R32`, `R16`, `QF`, `SF`, `F`

## v1 Screens

### Overview

Shows:

- player count
- team count
- champion pick distribution
- finalist pick distribution
- most popular semifinal teams
- quick links to other views

### Groups

Shows:

- one row per player
- Groups A-L as grouped columns
- multi-select toggle filter for Groups A-L, defaulting to all groups
- position 1-4 subcolumns under each group
- each player's selected team in every position

### Third-Place Picks

Shows:

- selected player's eight third-place advancer picks
- aggregate third-place pick counts across all players

### Knockout Bracket

Shows:

- selected player's predicted knockout bracket
- rounds: R32, R16, QF, SF, F
- winner highlighted in each match

### Compare

Shows:

- two-player comparison
- champion pick
- finalists
- semifinalists
- quarterfinalists
- group winners
- third-place advancer picks
- R32, R16, QF, SF, and F winner picks
- clear visual indication of matching and differing picks

### Schedule and Live Scores

Shows:

- upcoming matches
- live matches
- final scores
- match status
- group/round labels
- provider freshness and last successful fetch time

### Actual Groups and Bracket

Shows:

- actual group standings derived from match results
- qualification status when determinable
- actual knockout bracket slots and results when determinable

### Leaderboard

Leaderboard is included in v1 and uses `data/scoring_rules.json`.

Shows:

- rank
- player
- champion pick
- group points
- knockout points
- total points

The active scoring model awards 50 points for each exact group finishing position,
plus 30 points when all four positions in a group are exact. Knockout predictions
award 20 points for reaching the Round of 16, 30 for reaching the quarterfinals,
40 for reaching the semifinals, 75 for reaching the final, and 100 for the champion.
Group-stage scores are provisional during play and are recalculated from the current
standings as completed and in-progress scores change.

## Data Requirements

Required immediately:

- family picks from `data/family_bracket_picks.json`
- teams extracted from the same file
- member display names extracted from the same file
- normalized schedule and match status from a browser-compatible ESPN provider adapter
- actual match results as available from the match provider
- actual group standings derived from available results
- actual knockout bracket outcomes as available from match results

Active scoring source:

- `data/scoring_rules.json`

## Polling Requirements

Polling is only for changing tournament data.

Changing data:

- live match scores
- match clock/status
- actual group standings
- actual knockout bracket
- leaderboard/scoring derived from actual results

Stable data:

- family picks
- members
- teams
- scoring rules
- bracket pick structure

The UI should poll ESPN every 30 seconds while visible. The provider layer normalizes raw payloads into `Match[]`; tab-level selectors derive only the data needed by the active view. Failed refreshes retain the last successful in-memory snapshot for the current session.

## Functional Requirements

- Load and render the extracted family picks.
- Normalize teams and member identities from the extracted data.
- Fetch and normalize live match data directly in each visible browser.
- Provide a stable generated app-state contract.
- Render all bracket-pick views without a database.
- Render schedule, live scores, match status, and freshness.
- Generate actual group standings from available match results.
- Generate actual knockout bracket slots and results from available match results.
- Generate leaderboard scoring from available actual results.
- Support client-side interactions: tabs, member selection, comparisons, and filtering.
- Preserve exact source names while displaying trimmed names in the UI.
- Detect and report extracted-data anomalies before generating the app state.

## Quality Requirements

- Fast initial load for a small private audience.
- Mobile-friendly enough for phone viewing.
- Dense, scannable sports-dashboard UI.
- Clear stale-data indicator for match provider data.
- Data-shape validation for extracted picks and generated app state.

## Success Criteria

v1 is successful when:

- The app renders all 30 extracted player brackets.
- Users can navigate overview, participants, groups, third-place, knockout, and comparison views.
- Users can view schedule, live scores, match status, and actual group standings.
- The app indicates when live data was last refreshed.
- The app can be deployed and shared with family.
- The leaderboard scores from the active v1 scoring rules without changing the UI data contract.

## Open Product Questions

- Before sharing, should the v1 app use an unlisted URL or simple password protection?
