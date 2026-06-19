import { describe, expect, it } from "vitest";
import { selectMobileHeaderMatch } from "@/lib/app-data/headerMatches";
import type { Match } from "@/lib/schemas/appData";

function match(id: string, kickoffAt: string, status: Match["status"]): Match {
  return {
    id,
    providerIds: { espn: id },
    stage: "group",
    round: "Group A",
    group: "A",
    kickoffAt,
    status,
    statusText: status,
    clock: null,
    homeTeamId: "team_mex",
    awayTeamId: "team_rsa",
    homeTeamName: "Mexico",
    awayTeamName: "South Africa",
    homeScore: 0,
    awayScore: 0,
    winnerTeamId: null,
    venue: { name: null, city: null, country: null },
  };
}

describe("selectMobileHeaderMatch", () => {
  const now = new Date("2026-06-19T20:00:00Z").getTime();
  const completed = match("completed", "2026-06-19T16:00:00Z", "post");
  const live = match("live", "2026-06-19T19:00:00Z", "in");
  const upcoming = match("upcoming", "2026-06-19T22:00:00Z", "pre");

  it("prioritizes a live match", () => {
    expect(selectMobileHeaderMatch([upcoming, completed, live], now)).toBe(live);
  });

  it("shows the next kickoff when no match is live", () => {
    expect(selectMobileHeaderMatch([upcoming, completed], now)).toBe(upcoming);
  });

  it("falls back to the latest completed match when the day is over", () => {
    const latest = match("latest", "2026-06-19T18:00:00Z", "post");
    expect(selectMobileHeaderMatch([latest, completed], now)).toBe(latest);
  });
});
