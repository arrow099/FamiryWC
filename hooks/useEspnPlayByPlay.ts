"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchEspnPlayByPlay, type EspnPlayByPlayEntry } from "@/lib/providers/espn";

type PlayByPlayState = {
  entries: EspnPlayByPlayEntry[];
  capturedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  message: string | null;
};

const EMPTY_STATE: PlayByPlayState = {
  entries: [],
  capturedAt: null,
  loading: false,
  refreshing: false,
  message: null,
};

export function useEspnPlayByPlay(eventId: string | null, enabled: boolean, live: boolean, pollIntervalMs = 10_000): PlayByPlayState {
  const [state, setState] = useState<PlayByPlayState>(EMPTY_STATE);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!eventId || !enabled || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setState((current) => ({ ...current, loading: current.capturedAt === null, refreshing: true, message: null }));

    try {
      const result = await fetchEspnPlayByPlay(eventId, { signal: controller.signal });
      setState({ ...result, loading: false, refreshing: false, message: null });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        message: error instanceof Error ? error.message : "Unable to load play-by-play.",
      }));
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [enabled, eventId]);

  useEffect(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setState(enabled && eventId ? { ...EMPTY_STATE, loading: true } : EMPTY_STATE);
    if (!enabled || !eventId) return;

    let intervalId: number | null = null;
    const stopPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = null;
    };
    const startPolling = () => {
      stopPolling();
      if (live && document.visibilityState === "visible") intervalId = window.setInterval(refresh, pollIntervalMs);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
      startPolling();
    };

    void refresh();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, [enabled, eventId, live, pollIntervalMs, refresh]);

  return state;
}
