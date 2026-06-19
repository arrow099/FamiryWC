"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchEspnScoreboard } from "@/lib/providers/espn";
import type { Match } from "@/lib/schemas/appData";

export type LiveMatchesState = {
  matches: Match[];
  capturedAt: string | null;
  lastSuccessfulFetchAt: string | null;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  message: string | null;
};

const INITIAL_STATE: LiveMatchesState = {
  matches: [],
  capturedAt: null,
  lastSuccessfulFetchAt: null,
  loading: true,
  refreshing: false,
  stale: true,
  message: null,
};

export function useEspnLiveMatches(canonicalTeamIds: ReadonlySet<string>, pollIntervalMs = 30_000): LiveMatchesState {
  const [state, setState] = useState(INITIAL_STATE);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;

    const controller = new AbortController();
    inFlight.current = controller;
    setState((current) => ({ ...current, refreshing: true }));

    try {
      const result = await fetchEspnScoreboard({ signal: controller.signal, canonicalTeamIds });
      setState({
        matches: result.matches,
        capturedAt: result.capturedAt,
        lastSuccessfulFetchAt: result.capturedAt,
        loading: false,
        refreshing: false,
        stale: result.matches.length === 0,
        message: result.matches.length === 0 ? "ESPN returned no tournament matches." : result.message,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        stale: true,
        message: error instanceof Error ? error.message : "Unable to load ESPN match data.",
      }));
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [canonicalTeamIds]);

  useEffect(() => {
    let intervalId: number | null = null;

    const stopPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = null;
    };
    const startPolling = () => {
      stopPolling();
      if (document.visibilityState === "visible") {
        intervalId = window.setInterval(refresh, pollIntervalMs);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
      startPolling();
    };
    const handleResume = () => void refresh();

    void refresh();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleResume);
    window.addEventListener("online", handleResume);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("online", handleResume);
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, [pollIntervalMs, refresh]);

  return state;
}
