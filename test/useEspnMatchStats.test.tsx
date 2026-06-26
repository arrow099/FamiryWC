import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEspnMatchStats } from "@/hooks/useEspnMatchStats";
import { fetchEspnMatchStats, type EspnMatchStatsSummary } from "@/lib/providers/espn";
import type { Match } from "@/lib/schemas/appData";

vi.mock("@/lib/providers/espn", () => ({
  fetchEspnMatchStats: vi.fn(),
}));

function match(clock: string | null): Match {
  return {
    id: "match_001",
    providerIds: { espn: "401000001" },
    stage: "group",
    round: "FIFA World Cup, Group A",
    group: "A",
    kickoffAt: "2026-06-11T20:00:00Z",
    status: "in",
    statusText: "Live",
    clock,
    homeTeamId: "team_mex",
    awayTeamId: "team_rsa",
    homeTeamName: "Mexico",
    awayTeamName: "South Africa",
    homeScore: 1,
    awayScore: 0,
    winnerTeamId: null,
    venue: { name: null, city: null, country: null },
  };
}

function summary(capturedAt: string): EspnMatchStatsSummary {
  return {
    eventId: "401000001",
    capturedAt,
    teamStats: [],
    playerStats: [],
    scoringPlays: [],
    playByPlay: [],
  };
}

describe("useEspnMatchStats", () => {
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
    vi.mocked(fetchEspnMatchStats).mockReset();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("keeps existing summaries visible while a changed match signature refreshes", async () => {
    vi.mocked(fetchEspnMatchStats).mockResolvedValueOnce(summary("2026-06-20T14:00:00.000Z"));
    const pendingRefresh = new Promise<EspnMatchStatsSummary>(() => undefined);
    vi.mocked(fetchEspnMatchStats).mockReturnValueOnce(pendingRefresh);

    const { result, rerender } = renderHook(
      ({ matches }) => useEspnMatchStats(matches, true),
      { initialProps: { matches: [match("10:00")] } },
    );

    await waitFor(() => expect(result.current.summaries).toHaveLength(1));
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);

    rerender({ matches: [match("10:30")] });
    await waitFor(() => expect(fetchEspnMatchStats).toHaveBeenCalledTimes(2));

    expect(result.current.summaries).toHaveLength(1);
    expect(result.current.summaries[0].capturedAt).toBe("2026-06-20T14:00:00.000Z");
    expect(result.current.loading).toBe(false);
  });
});
