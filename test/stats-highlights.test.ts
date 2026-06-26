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
      stats: [
        { key: "shotsOnTarget", label: "Shots on target", value: 8, displayValue: "8" },
        { key: "saves", label: "Saves", value: saves, displayValue: String(saves) },
        { key: "possessionPct", label: "Possession", value: 55, displayValue: "55%" },
        { key: "cornerKicks", label: "Corners", value: 6, displayValue: "6" },
        { key: "fouls", label: "Fouls", value: 9, displayValue: "9" },
        { key: "yellowCards", label: "Yellow cards", value: 1, displayValue: "1" },
        { key: "redCards", label: "Red cards", value: 0, displayValue: "0" },
      ],
    }, {
      teamName: "Mexico",
      teamAbbr: "MEX",
      stats: [
        { key: "shotsOnTarget", label: "Shots on target", value: 3, displayValue: "3" },
        { key: "saves", label: "Saves", value: 2, displayValue: "2" },
        { key: "possessionPct", label: "Possession", value: 45, displayValue: "45%" },
        { key: "yellowCards", label: "Yellow cards", value: 2, displayValue: "2" },
        { key: "redCards", label: "Red cards", value: 1, displayValue: "1" },
      ],
    }],
    playerStats: [{
      playerName: "Player One",
      teamName: "Argentina",
      teamAbbr: "ARG",
      starter: true,
      stats: [
        { key: "totalGoals", label: "Goals", value: goals, displayValue: String(goals) },
        { key: "goalAssists", label: "Assists", value: 1, displayValue: "1" },
        { key: "shotsOnTarget", label: "Shots on target", value: 2, displayValue: "2" },
        { key: "saves", label: "Saves", value: saves, displayValue: String(saves) },
        { key: "accuratePasses", label: "Accurate passes", value: 21, displayValue: "21" },
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

    expect(data.liveMatchStats[0]).toMatchObject({
      matchId: "match_003",
      matchLabel: "Argentina vs Mexico",
    });
    expect(data.liveMatchStats[0].cards.map((card) => card.title)).toEqual([
      "Score",
      "Shots on target",
      "Cards",
    ]);
    expect(data.liveMatchStats[0].cards[0]).toMatchObject({
      homeValueLabel: "1",
      awayValueLabel: "1",
    });
    expect(data.liveMatchStats[0].cards.find((card) => card.title === "Cards")).toMatchObject({
      homeValueLabel: "🟨 1 / 0",
      awayValueLabel: "🟨🟨 2 / 🟥 1",
    });
    expect(data.tournamentHighlights.playerTournamentGoals[0]).toMatchObject({ statLabel: "Player goals", valueLabel: "4" });
    expect(data.tournamentHighlights.teamTournamentGoals[0]).toMatchObject({ statLabel: "Team goals", valueLabel: "6" });
    expect(data.tournamentHighlights.playerTournamentGoals.map((row) => row.valueLabel)).toEqual(["4"]);
    expect(data.tournamentHighlights.playerTournamentGoals[0]).toMatchObject({ statLabel: "Player goals", matchLabel: "Tournament total" });
    expect(data.tournamentHighlights.playerSingleMatchGoals[0]).toMatchObject({ statLabel: "Single-match player goals", valueLabel: "3" });
    expect(data.tournamentHighlights.teamTournamentGoals.map((row) => ({ subject: row.subject, valueLabel: row.valueLabel }))).toEqual([
      { subject: "Argentina", valueLabel: "6" },
      { subject: "Mexico", valueLabel: "1" },
    ]);
    expect(data.tournamentHighlights.teamTournamentGoals[0]).toMatchObject({ statLabel: "Team goals", matchLabel: "Tournament total" });
    expect(data.tournamentHighlights.teamSingleMatchGoals[0]).toMatchObject({ statLabel: "Single-match team goals", subject: "Argentina", valueLabel: "4" });
    expect(Object.keys(data.tournamentHighlights)).toEqual([
      "playerTournamentGoals",
      "teamTournamentGoals",
      "playerSingleMatchGoals",
      "teamSingleMatchGoals",
      "playerShotsOnTarget",
      "teamShotsOnTarget",
      "corners",
    ]);
    expect(data.tournamentHighlights.assists).toBeUndefined();
    expect(data.tournamentHighlights.playerSaves).toBeUndefined();
    expect(data.tournamentHighlights.teamSaves).toBeUndefined();
    expect(data.tournamentHighlights.possession).toBeUndefined();
    expect(data.tournamentHighlights.playerPassing).toBeUndefined();
    expect(data.tournamentHighlights.teamPassing).toBeUndefined();
    expect(data.tournamentHighlights.passPercentage).toBeUndefined();
    expect(data.tournamentHighlights.fouls).toBeUndefined();
  });
});
