import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/Dashboard";
import { buildStaticAppData } from "@/lib/app-data/buildAppData";
import * as tournamentResults from "@/lib/app-data/deriveTournamentResults";

vi.mock("@/hooks/useEspnLiveMatches", () => ({
  useEspnLiveMatches: () => ({
    matches: [],
    capturedAt: "2026-06-19T12:00:00.000Z",
    lastSuccessfulFetchAt: "2026-06-19T12:00:00.000Z",
    loading: false,
    refreshing: false,
    stale: false,
    message: null,
  }),
}));

describe("Dashboard live derivation", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        get length() { return values.size; },
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("builds tournament results for the default Leaderboard tab", async () => {
    const buildResults = vi.spyOn(tournamentResults, "buildTournamentResults");
    render(<Dashboard initialData={buildStaticAppData()} />);

    expect(buildResults).toHaveBeenCalled();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Leaderboard",
      "Groups",
      "Knockout",
      "Schedule",
      "Stats",
    ]);
    expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Participants" })).not.toBeInTheDocument();
    expect(screen.queryByText(/50 points per exact current position/)).not.toBeInTheDocument();
    fireEvent.mouseOver(screen.getByRole("button", { name: "Show scoring rules" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/50 points per exact current position/);
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Rank",
      "Participant",
      "Champion",
      "Group",
      "Knockout",
      "Total",
    ]);
  });

  it("restores and updates the last selected dashboard tab", async () => {
    window.localStorage.setItem("famirywc:last-dashboard-tab", "Schedule");
    render(<Dashboard initialData={buildStaticAppData()} initialTab="Schedule" />);

    expect(screen.getByRole("tab", { name: "Schedule" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    expect(window.localStorage.getItem("famirywc:last-dashboard-tab")).toBe("Groups");
  });

  it("orders Groups and Knockout participants by the active leaderboard", () => {
    const initialData = buildStaticAppData();
    const expectedOrder = tournamentResults.buildTournamentResults(initialData, []).leaderboard.map((entry) => entry.displayName);
    render(<Dashboard initialData={initialData} />);

    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    expect(screen.getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(expectedOrder);

    fireEvent.click(screen.getByRole("tab", { name: "Knockout" }));
    expect(screen.getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(expectedOrder);
  });

  it("fills every pick green when all four group positions are correct", () => {
    const initialData = buildStaticAppData();
    const results = tournamentResults.buildTournamentResults(initialData, []);
    const firstMember = initialData.members[0];
    const groupPicks = initialData.picks.find((pick) => pick.memberId === firstMember.id)!.groups.A;
    results.groups.A = groupPicks.map((pick) => ({
      teamId: pick.teamId,
      position: pick.position,
      played: 3,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      qualified: pick.position <= 2,
      qualificationType: "unknown",
    }));
    vi.spyOn(tournamentResults, "buildTournamentResults").mockReturnValue(results);
    render(<Dashboard initialData={initialData} />);

    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    const rowHeader = screen.getByRole("rowheader", { name: firstMember.displayName });
    const row = rowHeader.closest("tr")!;
    const exactGroupBadges = row.querySelectorAll('[data-correct-group="true"]');

    expect(exactGroupBadges).toHaveLength(4);
    for (const badge of exactGroupBadges) {
      expect(getComputedStyle(badge).backgroundColor).toBe("rgb(46, 125, 50)");
      expect(getComputedStyle(badge.querySelector("span span:last-child")!).color).toBe("rgb(255, 255, 255)");
    }
  });
});
