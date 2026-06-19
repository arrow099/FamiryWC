import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEspnLiveMatches } from "@/hooks/useEspnLiveMatches";
import { fetchEspnScoreboard } from "@/lib/providers/espn";
import type { Match } from "@/lib/schemas/appData";

vi.mock("@/lib/providers/espn", () => ({
  fetchEspnScoreboard: vi.fn(),
}));

const match = {
  id: "match_001",
  providerIds: { espn: "401000001" },
  stage: "group",
  round: "FIFA World Cup, Group A",
  group: "A",
  kickoffAt: "2026-06-11T20:00:00Z",
  status: "pre",
  statusText: "Scheduled",
  clock: null,
  homeTeamId: "team_mex",
  awayTeamId: "team_rsa",
  homeTeamName: "Mexico",
  awayTeamName: "South Africa",
  homeScore: 0,
  awayScore: 0,
  winnerTeamId: null,
  venue: { name: null, city: null, country: null },
} satisfies Match;

describe("useEspnLiveMatches", () => {
  beforeEach(() => {
    vi.mocked(fetchEspnScoreboard).mockReset();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("loads immediately and retains the last good matches after a refresh failure", async () => {
    const teamIds = new Set(["team_mex", "team_rsa"]);
    vi.mocked(fetchEspnScoreboard)
      .mockResolvedValueOnce({ matches: [match], capturedAt: "2026-06-19T12:00:00.000Z", message: null })
      .mockRejectedValueOnce(new Error("ESPN unavailable"));

    const { result } = renderHook(() => useEspnLiveMatches(teamIds));

    await waitFor(() => expect(result.current.matches).toEqual([match]));
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(result.current.message).toBe("ESPN unavailable"));

    expect(result.current.matches).toEqual([match]);
    expect(result.current.stale).toBe(true);
  });

  it("pauses polling while hidden and refreshes when visible again", async () => {
    const teamIds = new Set(["team_mex", "team_rsa"]);
    vi.useFakeTimers();
    vi.mocked(fetchEspnScoreboard).mockResolvedValue({ matches: [match], capturedAt: "2026-06-19T12:00:00.000Z", message: null });
    const { unmount } = renderHook(() => useEspnLiveMatches(teamIds, 30_000));

    await act(async () => Promise.resolve());
    expect(fetchEspnScoreboard).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(fetchEspnScoreboard).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => Promise.resolve());
    expect(fetchEspnScoreboard).toHaveBeenCalledTimes(2);

    unmount();
    vi.useRealTimers();
  });

  it("aborts the active ESPN request when unmounted", () => {
    const teamIds = new Set(["team_mex"]);
    let signal: AbortSignal | undefined;
    vi.mocked(fetchEspnScoreboard).mockImplementation((options) => {
      signal = options?.signal;
      return new Promise(() => undefined);
    });

    const { unmount } = renderHook(() => useEspnLiveMatches(teamIds));
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
