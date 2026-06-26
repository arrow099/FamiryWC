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

function summarySignature(summary: EspnMatchStatsSummary): string {
  const cached = summary as CachedSummary;
  return `${summary.eventId}|${summary.capturedAt}|${cached.cacheSignature ?? ""}`;
}

function summariesEqual(left: EspnMatchStatsSummary[], right: EspnMatchStatsSummary[]): boolean {
  return left.length === right.length && left.every((summary, index) => summarySignature(summary) === summarySignature(right[index]));
}

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
  const targetMatchesRef = useRef<Match[]>(targetMatches);
  targetMatchesRef.current = targetMatches;
  const targetKey = useMemo(() => targetMatches.map((match) => cacheSignature(match)).join("::"), [targetMatches]);

  const refresh = useCallback(async () => {
    const matchesToFetch = targetMatchesRef.current;
    if (!enabled || matchesToFetch.length === 0 || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setState((current) => {
      if (current.summaries.length > 0 && current.capturedAt !== null && !current.message) return current;

      return {
        ...current,
        loading: current.capturedAt === null,
        refreshing: true,
        message: current.summaries.length === 0 ? current.message : null,
      };
    });

    try {
      const cache = readCache();
      const fetched: EspnMatchStatsSummary[] = [];
      const summaries: EspnMatchStatsSummary[] = [];

      for (const match of matchesToFetch) {
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
      setState((current) => {
        if (
          !current.loading
          && !current.refreshing
          && current.message === null
          && current.capturedAt === capturedAt
          && summariesEqual(current.summaries, summaries)
        ) {
          return current;
        }

        return { summaries, capturedAt, loading: false, refreshing: false, message: null };
      });
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
  }, [enabled]);

  useEffect(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    const matchesToFetch = targetMatchesRef.current;
    setState((current) => {
      if (!enabled || matchesToFetch.length === 0) return current === EMPTY_STATE ? current : EMPTY_STATE;
      if (current.summaries.length > 0 || current.capturedAt !== null) return current;
      return current.loading && current.refreshing ? current : { ...current, loading: true, refreshing: true };
    });
    if (!enabled || matchesToFetch.length === 0) return;

    let intervalId: number | null = null;
    const stopPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = null;
    };
    const startPolling = () => {
      stopPolling();
      if (targetMatchesRef.current.some((match) => match.status === "in") && document.visibilityState === "visible") {
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
  }, [enabled, pollIntervalMs, refresh, targetKey]);

  return state;
}
