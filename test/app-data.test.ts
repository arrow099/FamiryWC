import { describe, expect, it } from "vitest";
import { buildAppData } from "@/lib/app-data/buildAppData";
import { normalizePicks } from "@/lib/app-data/normalizePicks";
import { buildLeaderboard } from "@/lib/app-data/scoring";
import { buildGroupStandings } from "@/lib/app-data/standings";
import { formatTeamLabel } from "@/lib/app-data/teamDisplay";
import { DEFAULT_ESPN_SCOREBOARD_URL, normalizeEspnScoreboard, normalizeEspnSummary } from "@/lib/providers/espn";
import familyPicks from "@/data/family_bracket_picks.json";
import scoringRules from "@/data/scoring_rules.json";
import type { AppState, Match } from "@/lib/schemas/appData";

describe("app data", () => {
  it("normalizes extracted family picks into stable app state", () => {
    const state = buildAppData({ capturedAt: "2026-06-18T00:00:00.000Z" });

    expect(state.members).toHaveLength(30);
    expect(state.teams).toHaveLength(48);
    expect(state.picks).toHaveLength(30);
    expect(state.members[0].id).toBe("member_leppy27");
    expect(state.teams.find((team) => team.abbr === "ARG")?.id).toBe("team_arg");
    expect(state.picks[0].knockout.R32).toHaveLength(16);
  });

  it("formats app team labels with flag and abbreviation only", () => {
    const state = buildAppData({ capturedAt: "2026-06-18T00:00:00.000Z" });
    const argentina = state.teams.find((team) => team.abbr === "ARG");

    expect(argentina?.name).toBe("Argentina");
    expect(formatTeamLabel(argentina)).toBe("🇦🇷 ARG");
    expect(formatTeamLabel(null)).toBe("-");
  });

  it("rejects invalid knockout winners", () => {
    const broken = structuredClone(familyPicks);
    broken.players[0].knockout.R32[0].winner = broken.players[0].knockout.R32[1].winner;

    expect(() => normalizePicks(broken)).toThrow(/winner is not in the match/);
  });

  it("rejects duplicate R32 team slots", () => {
    const broken = structuredClone(familyPicks);
    broken.players[0].knockout.R32[0].team2 = broken.players[0].knockout.R32[0].team1;
    broken.players[0].knockout.R32[0].winner = broken.players[0].knockout.R32[0].team1;

    expect(() => normalizePicks(broken)).toThrow(/duplicate R32 team slot/);
  });

  it("rejects non-canonical embedded teams in third-place and knockout picks", () => {
    const brokenThirdPlace = structuredClone(familyPicks);
    brokenThirdPlace.players[0].thirdPlace[0].name = "Not Scotland";

    expect(() => normalizePicks(brokenThirdPlace)).toThrow(/third-place pick .* does not match canonical team table/);

    const brokenKnockout = structuredClone(familyPicks);
    brokenKnockout.players[0].knockout.R32[0].team1.abbr = "BAD";

    expect(() => normalizePicks(brokenKnockout)).toThrow(/R32-1 team1 does not match canonical team table/);
  });

  it("scores the official FIFA group and knockout points", () => {
    const normalized = normalizePicks(familyPicks);
    const firstPick = normalized.picks[0];
    const membersById = new Map(normalized.members.map((member) => [member.id, member.displayName]));
    const groups = {
      A: firstPick.groups.A.map((pick, index) => ({
        teamId: pick.teamId,
        position: pick.position,
        played: 3,
        won: index === 0 ? 3 : 1,
        drawn: 0,
        lost: index === 0 ? 0 : 2,
        goalsFor: 3 - index,
        goalsAgainst: index,
        goalDifference: 3 - index * 2,
        points: index === 0 ? 9 : 3,
        qualified: index < 2,
        qualificationType: index === 0 ? "group_winner" : index === 1 ? "group_runner_up" : "eliminated",
      })),
    } as AppState["groups"];
    const actualBracket = Object.fromEntries(
      (["R32", "R16", "QF", "SF", "F"] as const).map((round) => [
        round,
        [{
          ...firstPick.knockout[round][0],
          matchId: `match_${round}`,
          winnerId: firstPick.knockout[round][0].winnerId,
          status: "post",
        }],
      ]),
    ) as AppState["actualBracket"];

    const leaderboard = buildLeaderboard([firstPick], membersById, groups, actualBracket, scoringRules);

    expect(leaderboard[0].groupPoints).toBe(230);
    expect(leaderboard[0].knockoutPoints).toBe(265);
    expect(leaderboard[0].knockoutPointsByRound).toEqual({ R32: 20, R16: 30, QF: 40, SF: 75, F: 100 });
    expect(leaderboard[0].totalPoints).toBe(495);
    expect(leaderboard[0].correctPicks).toEqual({ groups: 4, knockout: 5 });
  });

  it("scores an unfinished group from its current standings", () => {
    const normalized = normalizePicks(familyPicks);
    const firstPick = normalized.picks[0];
    const membersById = new Map(normalized.members.map((member) => [member.id, member.displayName]));
    const incompleteGroup = {
      A: firstPick.groups.A.map((pick, index) => ({
        teamId: pick.teamId,
        position: pick.position,
        played: index === 0 ? 2 : 3,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        qualified: false,
        qualificationType: "unknown",
      })),
    } as AppState["groups"];
    const emptyBracket = { R32: [], R16: [], QF: [], SF: [], F: [] } as AppState["actualBracket"];

    const [entry] = buildLeaderboard([firstPick], membersById, incompleteGroup, emptyBracket, scoringRules);

    expect(entry.groupPoints).toBe(230);
    expect(entry.totalPoints).toBe(230);
  });

  it("includes in-progress scores in provisional group standings", () => {
    const standings = buildGroupStandings([{
      id: "match_live",
      providerIds: { espn: "live_1" },
      stage: "group",
      round: "Group A",
      group: "A",
      kickoffAt: "2026-06-20T12:00:00.000Z",
      status: "in",
      statusText: "45'",
      clock: "45:00",
      homeTeamId: "team_mex",
      awayTeamId: "team_rsa",
      homeTeamName: "Mexico",
      awayTeamName: "South Africa",
      homeScore: 1,
      awayScore: 0,
      winnerTeamId: null,
      venue: { name: null, city: null, country: null },
    }]);

    expect(standings.A.map(({ teamId, position, points }) => ({ teamId, position, points }))).toEqual([
      { teamId: "team_mex", position: 1, points: 3 },
      { teamId: "team_rsa", position: 2, points: 0 },
    ]);
  });

  it("normalizes ESPN scoreboard fixtures", () => {
    const normalized = normalizeEspnScoreboard({
      events: [
        {
          id: "event_1",
          name: "Mexico vs South Africa",
          competitions: [
            {
              id: "401000001",
              date: "2026-06-11T20:00:00Z",
              altGameNote: "FIFA World Cup, Group A",
              status: { type: { state: "post", shortDetail: "Final" } },
              competitors: [
                { homeAway: "home", score: "2", winner: true, team: { abbreviation: "MEX" } },
                { homeAway: "away", score: "1", winner: false, team: { abbreviation: "RSA" } },
              ],
            },
          ],
        },
      ],
    }, undefined, new Set(["team_mex", "team_rsa"]));

    expect(normalized.matches[0]).toMatchObject<Partial<Match>>({
      id: "match_001",
      status: "post",
      stage: "group",
      round: "FIFA World Cup, Group A",
      group: "A",
      homeTeamId: "team_mex",
      awayTeamId: "team_rsa",
      homeTeamName: "MEX",
      awayTeamName: "RSA",
      winnerTeamId: "team_mex",
      homeScore: 2,
      awayScore: 1,
    });
  });

  it("preserves provider labels for unresolved knockout placeholders", () => {
    const normalized = normalizeEspnScoreboard({
      events: [
        {
          id: "event_1",
          name: "Round of 32 2 Winner at Round of 32 1 Winner",
          competitions: [
            {
              id: "401000001",
              date: "2026-07-09T20:00:00Z",
              altGameNote: "FIFA World Cup",
              status: { type: { state: "pre", shortDetail: "Scheduled" } },
              competitors: [
                { homeAway: "home", score: "0", team: { abbreviation: "RD16 W1", displayName: "Round of 16 1 Winner" } },
                { homeAway: "away", score: "0", team: { abbreviation: "RD16 W2", displayName: "Round of 16 2 Winner" } },
              ],
            },
          ],
        },
      ],
    }, undefined, new Set(["team_mex", "team_rsa"]));

    expect(normalized.matches[0]).toMatchObject<Partial<Match>>({
      homeTeamId: null,
      awayTeamId: null,
      homeTeamName: "Round of 16 1 Winner",
      awayTeamName: "Round of 16 2 Winner",
    });
  });

  it("uses the full ESPN World Cup schedule URL as the default", () => {
    expect(DEFAULT_ESPN_SCOREBOARD_URL).toBe("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200");
  });

  it("normalizes ESPN commentary newest-first with optional field positions", () => {
    const entries = normalizeEspnSummary({ commentary: [
      { sequence: 1, time: { displayValue: "1'" }, text: "Match starts." },
      {
        sequence: 2,
        text: "Shot by Mexico.",
        play: {
          id: "play_2",
          type: { text: "Shot" },
          clock: { displayValue: "2'" },
          team: { displayName: "Mexico" },
          participants: [{ athlete: { displayName: "Player One" } }],
          fieldPositionX: 0.72,
          fieldPositionY: 0.4,
        },
      },
    ] });

    expect(entries.map((entry) => entry.id)).toEqual(["play_2", "commentary-1"]);
    expect(entries[0]).toMatchObject({
      clock: "2'",
      type: "Shot",
      teamName: "Mexico",
      participants: ["Player One"],
      fieldPosition: { x: 0.72, y: 0.4 },
    });
    expect(entries[1].fieldPosition).toBeNull();
  });

  it("uses ESPN sequence order when stoppage-time clock labels overlap", () => {
    const entries = normalizeEspnSummary({ commentary: [
      { sequence: 10, text: "Earlier foul", play: { clock: { displayValue: "45'+4'" }, period: { number: 1 } } },
      { sequence: 11, time: { value: 2702, displayValue: "46'+1'" }, text: "Added-time announcement" },
    ] });

    expect(entries.map((entry) => entry.text)).toEqual([
      "Added-time announcement",
      "Earlier foul",
    ]);
    expect(entries[0].clock).toBe("45'+1'");
  });

});
