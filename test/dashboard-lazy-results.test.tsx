import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.restoreAllMocks());

  it("builds tournament results only after the Leaderboard tab is selected", () => {
    const buildResults = vi.spyOn(tournamentResults, "buildTournamentResults");
    render(<Dashboard initialData={buildStaticAppData()} />);

    expect(buildResults).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Leaderboard" }));

    expect(buildResults).toHaveBeenCalled();
    expect(screen.getByRole("columnheader", { name: "Total" })).toBeVisible();
  });
});
