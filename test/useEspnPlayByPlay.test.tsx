import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEspnPlayByPlay } from "@/hooks/useEspnPlayByPlay";
import { fetchEspnPlayByPlay } from "@/lib/providers/espn";

vi.mock("@/lib/providers/espn", () => ({ fetchEspnPlayByPlay: vi.fn() }));

describe("useEspnPlayByPlay", () => {
  beforeEach(() => {
    vi.mocked(fetchEspnPlayByPlay).mockReset();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("polls live commentary every 10 seconds while enabled", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchEspnPlayByPlay).mockResolvedValue({ entries: [], capturedAt: "2026-06-21T12:00:00.000Z" });
    const { unmount } = renderHook(() => useEspnPlayByPlay("401000001", true, true));

    await act(async () => Promise.resolve());
    expect(fetchEspnPlayByPlay).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchEspnPlayByPlay).toHaveBeenCalledTimes(2);

    unmount();
    vi.useRealTimers();
  });

  it("fetches completed games once and does not fetch pending or closed games", async () => {
    vi.mocked(fetchEspnPlayByPlay).mockResolvedValue({ entries: [], capturedAt: "2026-06-21T12:00:00.000Z" });
    const { rerender } = renderHook(
      ({ eventId, enabled }) => useEspnPlayByPlay(eventId, enabled, false),
      { initialProps: { eventId: null as string | null, enabled: false } },
    );
    expect(fetchEspnPlayByPlay).not.toHaveBeenCalled();

    rerender({ eventId: "401000001", enabled: true });
    await waitFor(() => expect(fetchEspnPlayByPlay).toHaveBeenCalledTimes(1));
    rerender({ eventId: "401000001", enabled: false });
    expect(fetchEspnPlayByPlay).toHaveBeenCalledTimes(1);
  });
});
