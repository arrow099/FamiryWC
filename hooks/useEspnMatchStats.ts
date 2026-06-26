"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchEspnMatchStats, type EspnMatchStatsSummary } from "@/lib/providers/espn";
import type { Match } from "@/lib/schemas/appData";

type MatchStatsState = {
  summaries: EspnMatchStatsSummary[];
  capturedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  message: string | null;
};

const EMPTY_STATE: MatchStatsState = {
  summaries: [],
  capturedAt: null,
  loading: false,
  refreshing: false,
  message: null,
};

const STORAGE_KEY = "famirywc:espn-match-stats:v1";

type CachedSummary = EspnMatchStatsSummary & {
  cacheSignature: string;
};

function cacheSignature(match: Match): string {
  return [
    match.providerIds.espn,
    match.status,
    match.homeScore ?? "",
    match.awayScore ?? "",
    match.clock ?? "",
  ].join("|");
}

function readCache(): Record<string, CachedSummary> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, CachedSummary>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CachedSummary>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Stats still work without browser storage.
  }
}

export function useEspnMatchStats(matches: Match[], enabled: boolean, pollIntervalMs = 60_000): MatchStatsState {
  const [state, setState] = useState<MatchStatsState>(EMPTY_STATE);
  const inFlight = useRef<AbortController | null>(null);
  const targetMatches = useMemo(
    () => matches.filter((match) => match.providerIds.espn && (match.status === "post" || match.status === "in")),
    [matches],
  );
  const targetKey = useMemo(() => targetMatches.map((match) => cacheSignature(match)).join("::"), [targetMatches]);

  const refresh = useCallback(async () => {
    if (!enabled || targetMatches.length === 0 || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setState((current) => ({ ...current, loading: current.capturedAt === null, refreshing: true, message: null }));

    try {
      const cache = readCache();
      const fetched: EspnMatchStatsSummary[] = [];
      const summaries: EspnMatchStatsSummary[] = [];

      for (const match of targetMatches) {
        const eventId = match.providerIds.espn!;
        const signature = cacheSignature(match);
        const cached = cache[eventId];
        if (cached?.cacheSignature === signature) {
          summaries.push(cached);
          continue;
        }

        const summary = await fetchEspnMatchStats(eventId, { signal: controller.signal });
        fetched.push(summary);
        summaries.push(summary);
        cache[eventId] = { ...summary, cacheSignature: signature };
      }

      if (fetched.length > 0) writeCache(cache);
      const capturedAt = summaries.reduce<string | null>((latest, summary) => (
        latest === null || summary.capturedAt > latest ? summary.capturedAt : latest
      ), null);
      setState({ summaries, capturedAt, loading: false, refreshing: false, message: null });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        message: error instanceof Error ? error.message : "Unable to load match stats.",
      }));
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [enabled, targetMatches]);

  useEffect(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setState(enabled && targetMatches.length > 0 ? { ...EMPTY_STATE, loading: true } : EMPTY_STATE);
    if (!enabled || targetMatches.length === 0) return;

    let intervalId: number | null = null;
    const stopPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = null;
    };
    const startPolling = () => {
      stopPolling();
      if (targetMatches.some((match) => match.status === "in") && document.visibilityState === "visible") {
        intervalId = window.setInterval(refresh, pollIntervalMs);
      }
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
  }, [enabled, pollIntervalMs, refresh, targetKey, targetMatches]);

  return state;
}
