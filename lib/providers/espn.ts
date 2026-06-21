import { matchIdFromIndex, teamIdFromAbbr } from "@/lib/app-data/ids";
import { GROUP_IDS, type GroupId, type Match, type MatchStatus } from "@/lib/schemas/appData";

export const DEFAULT_ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
export const DEFAULT_ESPN_SUMMARY_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";

export type EspnPlayByPlayEntry = {
  id: string;
  sequence: number;
  clock: string;
  text: string;
  type: string | null;
  teamName: string | null;
  participants: string[];
  fieldPosition: { x: number; y: number } | null;
};

type EspnCompetitor = {
  id?: string;
  homeAway?: "home" | "away";
  score?: string;
  team?: {
    id?: string;
    abbreviation?: string;
    shortDisplayName?: string;
    displayName?: string;
  };
  winner?: boolean;
};

type EspnCompetition = {
  id?: string;
  date?: string;
  altGameNote?: string;
  status?: {
    type?: {
      state?: string;
      description?: string;
      shortDetail?: string;
    };
    displayClock?: string;
  };
  competitors?: EspnCompetitor[];
  venue?: {
    fullName?: string;
    address?: {
      city?: string;
      country?: string;
    };
  };
};

type EspnEvent = {
  id?: string;
  name?: string;
  date?: string;
  season?: {
    slug?: string;
  };
  competitions?: EspnCompetition[];
};

export type EspnScoreboard = {
  events?: EspnEvent[];
};

type EspnSummaryCommentary = {
  sequence?: number;
  time?: { value?: number; displayValue?: string };
  text?: string;
  play?: {
    id?: string;
    text?: string;
    type?: { text?: string };
    clock?: { value?: number; displayValue?: string };
    period?: { number?: number };
    team?: { displayName?: string };
    participants?: Array<{ athlete?: { displayName?: string } }>;
    fieldPositionX?: number;
    fieldPositionY?: number;
  };
};

export type EspnSummary = {
  commentary?: EspnSummaryCommentary[];
};

function knownTeamId(abbr: string | undefined, canonicalTeamIds?: ReadonlySet<string>): string | null {
  if (!abbr) return null;

  const teamId = teamIdFromAbbr(abbr);
  return !canonicalTeamIds || canonicalTeamIds.has(teamId) ? teamId : null;
}

function normalizeStatus(state: string | undefined): MatchStatus {
  if (state === "pre") return "pre";
  if (state === "in") return "in";
  if (state === "post") return "post";
  return "unknown";
}

function competitorTeamId(competitor: EspnCompetitor | undefined, canonicalTeamIds?: ReadonlySet<string>): string | null {
  return knownTeamId(competitor?.team?.abbreviation, canonicalTeamIds);
}

function competitorTeamName(competitor: EspnCompetitor | undefined): string | null {
  return competitor?.team?.shortDisplayName ?? competitor?.team?.displayName ?? competitor?.team?.abbreviation ?? null;
}

function parseGroup(note: string | undefined): GroupId | null {
  const match = note?.match(/\bGroup\s+([A-L])\b/i);
  const group = match?.[1]?.toUpperCase();
  return GROUP_IDS.includes(group as GroupId) ? (group as GroupId) : null;
}

function normalizeStage(event: EspnEvent, group: GroupId | null): Match["stage"] {
  if (group || event.season?.slug === "group-stage") return "group";
  if (event.season?.slug && event.season.slug !== "group-stage") return "knockout";
  return "unknown";
}

export function normalizeEspnScoreboard(
  scoreboard: EspnScoreboard,
  capturedAt = new Date().toISOString(),
  canonicalTeamIds?: ReadonlySet<string>,
): { matches: Match[]; capturedAt: string } {
  const events = scoreboard.events ?? [];
  const matches = events.map((event, index): Match => {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const home = competitors.find((competitor) => competitor.homeAway === "home") ?? competitors[0];
    const away = competitors.find((competitor) => competitor.homeAway === "away") ?? competitors[1];
    const status = normalizeStatus(competition?.status?.type?.state);
    const homeScore = home?.score == null ? null : Number(home.score);
    const awayScore = away?.score == null ? null : Number(away.score);
    const group = parseGroup(competition?.altGameNote);

    return {
      id: matchIdFromIndex(index),
      providerIds: {
        espn: competition?.id ?? event.id ?? null,
      },
      stage: normalizeStage(event, group),
      round: competition?.altGameNote ?? event.name ?? "World Cup",
      group,
      kickoffAt: competition?.date ?? event.date ?? null,
      status,
      statusText: competition?.status?.type?.shortDetail ?? competition?.status?.type?.description ?? "Unknown",
      clock: competition?.status?.displayClock ?? null,
      homeTeamId: competitorTeamId(home, canonicalTeamIds),
      awayTeamId: competitorTeamId(away, canonicalTeamIds),
      homeTeamName: competitorTeamName(home),
      awayTeamName: competitorTeamName(away),
      homeScore: Number.isFinite(homeScore) ? homeScore : null,
      awayScore: Number.isFinite(awayScore) ? awayScore : null,
      winnerTeamId: home?.winner ? competitorTeamId(home, canonicalTeamIds) : away?.winner ? competitorTeamId(away, canonicalTeamIds) : null,
      venue: {
        name: competition?.venue?.fullName ?? null,
        city: competition?.venue?.address?.city ?? null,
        country: competition?.venue?.address?.country ?? null,
      },
    };
  });

  return { matches, capturedAt };
}

export async function fetchEspnScoreboard(options: {
  signal?: AbortSignal;
  canonicalTeamIds?: ReadonlySet<string>;
  url?: string;
} = {}): Promise<{ matches: Match[]; capturedAt: string; message: string | null }> {
  const response = await fetch(options.url ?? DEFAULT_ESPN_SCOREBOARD_URL, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`ESPN scoreboard request failed with ${response.status}`);
  }

  const json = (await response.json()) as EspnScoreboard;
  const normalized = normalizeEspnScoreboard(json, new Date().toISOString(), options.canonicalTeamIds);
  return { ...normalized, message: null };
}

function normalizedFieldPosition(x: number | undefined, y: number | undefined): EspnPlayByPlayEntry["fieldPosition"] {
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return null;
  return {
    x: Math.min(1, Math.max(0, x as number)),
    y: Math.min(1, Math.max(0, y as number)),
  };
}

export function normalizeEspnSummary(summary: EspnSummary): EspnPlayByPlayEntry[] {
  return (summary.commentary ?? [])
    .flatMap((commentary, index) => {
      const text = commentary.text ?? commentary.play?.text;
      if (!text) return [];
      const sequence = commentary.sequence ?? index;
      return [{
        entry: {
          id: commentary.play?.id ?? `commentary-${sequence}`,
          sequence,
          clock: normalizeEspnClock(
            commentary.play?.clock?.displayValue ?? commentary.time?.displayValue ?? "",
            commentary.play?.clock?.value ?? commentary.time?.value,
          ),
          text,
          type: commentary.play?.type?.text ?? null,
          teamName: commentary.play?.team?.displayName ?? null,
          participants: (commentary.play?.participants ?? []).flatMap((participant) =>
            participant.athlete?.displayName ? [participant.athlete.displayName] : [],
          ),
          fieldPosition: normalizedFieldPosition(commentary.play?.fieldPositionX, commentary.play?.fieldPositionY),
        },
        period: commentary.play?.period?.number,
      }];
    })
    // ESPN's clock labels are not arithmetic timestamps: a later event can be
    // labeled 46'+1' after events labeled 45'+4'. Sequence is the chronology.
    .sort((a, b) => b.entry.sequence - a.entry.sequence)
    .map(({ entry }) => entry);
}

function normalizeEspnClock(displayValue: string, seconds: number | undefined): string {
  const stoppage = displayValue.match(/^(\d{1,3})['’]\+(\d{1,2})['’]$/);
  if (!stoppage || !Number.isFinite(seconds)) return displayValue;

  const displayedBase = Number(stoppage[1]);
  const boundaries = [45, 90, 105, 120];
  if (boundaries.includes(displayedBase)) return displayValue;

  const elapsedMinutes = (seconds as number) / 60;
  const boundary = [...boundaries].reverse().find((minute) => elapsedMinutes >= minute);
  if (boundary === undefined) return displayValue;

  const addedMinute = Math.max(1, Math.ceil(elapsedMinutes - boundary));
  return `${boundary}'+${addedMinute}'`;
}

export async function fetchEspnPlayByPlay(eventId: string, options: {
  signal?: AbortSignal;
  url?: string;
} = {}): Promise<{ entries: EspnPlayByPlayEntry[]; capturedAt: string }> {
  const url = new URL(options.url ?? DEFAULT_ESPN_SUMMARY_URL);
  url.searchParams.set("event", eventId);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`ESPN match summary request failed with ${response.status}`);
  }

  const summary = (await response.json()) as EspnSummary;
  return { entries: normalizeEspnSummary(summary), capturedAt: new Date().toISOString() };
}
