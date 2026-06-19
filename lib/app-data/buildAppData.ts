import familyPicks from "@/data/family_bracket_picks.json";
import scoringRules from "@/data/scoring_rules.json";
import { buildTournamentResults } from "@/lib/app-data/deriveTournamentResults";
import { normalizePicks } from "@/lib/app-data/normalizePicks";
import {
  ROUND_IDS,
  type AppState,
  type Match,
  type ScoringRules,
  type StaticAppData,
} from "@/lib/schemas/appData";

export function buildStaticAppData(): StaticAppData {
  const normalized = normalizePicks(familyPicks);
  const scoring = scoringRules as ScoringRules;

  return {
    schemaVersion: 1,
    sources: {
      picks: normalized.source.source,
    },
    league: {
      name: "Famiry World Cup Bracket Challenge",
      year: 2026,
      playerCount: normalized.members.length,
      teamCount: normalized.teams.length,
      groupCount: 12,
      rounds: [...ROUND_IDS],
    },
    teams: normalized.teams,
    members: normalized.members,
    picks: normalized.picks,
    scoring,
  };
}

export function buildAppData(options: { matches?: Match[]; providerMeta?: Partial<AppState["sources"]["matches"]>; capturedAt?: string } = {}): AppState {
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const matches = options.matches ?? [];
  const staticData = buildStaticAppData();
  const results = buildTournamentResults(staticData, matches);

  return {
    ...staticData,
    ...results,
    capturedAt,
    sources: {
      ...staticData.sources,
      matches: {
        provider: "espn",
        capturedAt: options.providerMeta?.capturedAt ?? null,
        lastSuccessfulFetchAt: options.providerMeta?.lastSuccessfulFetchAt ?? null,
        stale: options.providerMeta?.stale ?? matches.length === 0,
        message: options.providerMeta?.message ?? (matches.length === 0 ? "No live match data loaded yet." : null),
      },
    },
    matches,
  };
}
