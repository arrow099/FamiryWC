import { describe, expect, it } from "vitest";
import { buildStatsDashboardData } from "@/lib/statsHighlights";
import type { EspnMatchStatsSummary } from "@/lib/providers/espn";
import type { Match } from "@/lib/schemas/appData";

function match(id: string, eventId: string, status: Match["status"], homeScore: number, awayScore: number): Match {
  return {
    id,
    providerIds: { espn: eventId },
    stage: "group",
    round: "Group A",
    group: "A",
    kickoffAt: "2026-06-20T12:00:00.000Z",
    status,
    statusText: status === "post" ? "Final" : "Live",
    clock: status === "in" ? "45:00" : null,
    homeTeamId: "team_arg",
    awayTeamId: "team_mex",
    homeTeamName: "Argentina",
    awayTeamName: "Mexico",
    homeScore,
    awayScore,
    winnerTeamId: status === "post" ? "team_arg" : null,
    venue: { name: null, city: null, country: null },
  };
}

function summary(eventId: string, goals: number, saves: number): EspnMatchStatsSummary {
  return {
    eventId,
    capturedAt: "2026-06-20T14:00:00.000Z",
    teamStats: [{
      teamName: "Argentina",
      teamAbbr: "ARG",
      stats: [{ key: "totalShots", label: "Shots", value: 18, displayValue: "18" }],
    }],
    playerStats: [{
      playerName: "Player One",
      teamName: "Argentina",
      teamAbbr: "ARG",
      starter: true,
      stats: [
        { key: "totalGoals", label: "Goals", value: goals, displayValue: String(goals) },
        { key: "saves", label: "Saves", value: saves, displayValue: String(saves) },
      ],
    }],
    scoringPlays: [{ id: "scoring-1", clock: "10'", teamName: "Argentina", text: "Goal: Player One" }],
    playByPlay: [],
  };
}

describe("stats highlights", () => {
  it("builds deterministic tournament and live highlights from ESPN summaries", () => {
    const data = buildStatsDashboardData(
      [
        match("match_001", "event_1", "post", 2, 0),
        match("match_002", "event_2", "post", 4, 1),
        match("match_003", "event_3", "in", 1, 1),
      ],
      [
        summary("event_1", 1, 2),
        summary("event_2", 3, 1),
        summary("event_3", 1, 5),
      ],
    );

    expect(data.tournamentHighlights[0]).toMatchObject({
      scope: "tournament",
      title: "Best so far: Goals",
      subject: "Player One",
      valueLabel: "3",
    });
    expect(data.liveHighlights[0]).toMatchObject({
      scope: "live",
      title: "Live standout: Saves",
      valueLabel: "5",
    });
    expect(data.playerLeaderboards.totalGoals.map((row) => row.valueLabel)).toEqual(["4"]);
    expect(data.playerLeaderboards.totalGoals[0].matchLabel).toBe("Tournament total");
    expect(data.teamLeaderboards.totalGoals.map((row) => ({ subject: row.subject, valueLabel: row.valueLabel }))).toEqual([
      { subject: "Argentina", valueLabel: "6" },
      { subject: "Mexico", valueLabel: "1" },
    ]);
    expect(data.teamLeaderboards.totalGoals[0].matchLabel).toBe("Tournament total");
    expect(data.teamLeaderboards.totalShots).toHaveLength(2);
  });
});
