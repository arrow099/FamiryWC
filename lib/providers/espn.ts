import { matchIdFromIndex, teamIdFromAbbr } from "@/lib/app-data/ids";
import { GROUP_IDS, type GroupId, type Match, type MatchStatus } from "@/lib/schemas/appData";

export const DEFAULT_ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";

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
