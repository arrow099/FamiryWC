import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cron/refresh/route";
import { buildAppData } from "@/lib/app-data/buildAppData";
import { normalizePicks } from "@/lib/app-data/normalizePicks";
import { refreshLiveData } from "@/lib/app-data/refreshLiveData";
import { buildLeaderboard } from "@/lib/app-data/scoring";
import { formatTeamLabel } from "@/lib/app-data/teamDisplay";
import { DEFAULT_ESPN_SCOREBOARD_URL, normalizeEspnScoreboard } from "@/lib/providers/espn";
import familyPicks from "@/data/family_bracket_picks.json";
import scoringRules from "@/data/scoring_rules.json";
import type { AppState, Match } from "@/lib/schemas/appData";

vi.mock("@/lib/app-data/refreshLiveData", () => ({
  refreshLiveData: vi.fn(),
}));

describe("app data", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(refreshLiveData).mockReset();
  });

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

  it("scores completed group, third-place, knockout, and champion results", () => {
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
    const actualBracket = {
      R32: [{ ...firstPick.knockout.R32[0], matchId: "match_001", winnerId: firstPick.knockout.R32[0].winnerId, status: "post" }],
      R16: [],
      QF: [],
      SF: [],
      F: [{ ...firstPick.knockout.F[0], matchId: "match_064", winnerId: firstPick.championPick, status: "post" }],
    } as AppState["actualBracket"];

    const leaderboard = buildLeaderboard([firstPick], membersById, groups, actualBracket, scoringRules);

    expect(leaderboard[0].groupPoints).toBeGreaterThan(0);
    expect(leaderboard[0].knockoutPoints).toBe(14);
    expect(leaderboard[0].championBonus).toBe(10);
    expect(leaderboard[0].totalPoints).toBeGreaterThan(20);
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
    });

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
    });

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

  it("requires cron authorization outside local development", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CRON_SECRET", "");

    const response = await POST(new Request("http://localhost/api/cron/refresh", { method: "POST" }));

    expect(response.status).toBe(503);
    expect(refreshLiveData).not.toHaveBeenCalled();
  });

  it("rejects cron refresh requests with the wrong secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "expected");

    const response = await POST(
      new Request("http://localhost/api/cron/refresh", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );

    expect(response.status).toBe(401);
    expect(refreshLiveData).not.toHaveBeenCalled();
  });

  it("allows cron refresh requests with the configured secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "expected");
    vi.mocked(refreshLiveData).mockResolvedValue(buildAppData({ capturedAt: "2026-06-18T00:00:00.000Z" }));

    const response = await POST(
      new Request("http://localhost/api/cron/refresh", {
        method: "POST",
        headers: { authorization: "Bearer expected" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ capturedAt: "2026-06-18T00:00:00.000Z", matches: 0, stale: true });
  });
});
