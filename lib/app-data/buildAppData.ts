import familyPicks from "@/data/family_bracket_picks.json";
import scoringRules from "@/data/scoring_rules.json";
import { normalizePicks } from "@/lib/app-data/normalizePicks";
import { buildLeaderboard } from "@/lib/app-data/scoring";
import { buildGroupStandings } from "@/lib/app-data/standings";
import { ROUND_IDS, type ActualBracketSlot, type AppState, type Match, type RoundId, type ScoringRules } from "@/lib/schemas/appData";

function emptyActualBracket(): AppState["actualBracket"] {
  return {
    R32: [],
    R16: [],
    QF: [],
    SF: [],
    F: [],
  };
}

function buildActualBracket(matches: Match[]): AppState["actualBracket"] {
  const bracket = emptyActualBracket();
  const knockoutMatches = matches.filter((match) => match.stage === "knockout");
  for (const round of ROUND_IDS) {
    bracket[round] = knockoutMatches
      .filter((match) => match.round === round)
      .map((match, index): ActualBracketSlot => ({
        slotId: `${round}-${index + 1}`,
        round: round as RoundId,
        bracketId: index + 1,
        matchId: match.id,
        team1Id: match.homeTeamId,
        team2Id: match.awayTeamId,
        winnerId: match.winnerTeamId,
        status: match.status,
      }));
  }
  return bracket;
}

export function buildAppData(options: { matches?: Match[]; providerMeta?: Partial<AppState["sources"]["matches"]>; capturedAt?: string } = {}): AppState {
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const normalized = normalizePicks(familyPicks);
  const matches = options.matches ?? [];
  const groups = buildGroupStandings(matches);
  const actualBracket = buildActualBracket(matches);
  const membersById = new Map(normalized.members.map((member) => [member.id, member.displayName]));
  const scoring = scoringRules as ScoringRules;
  const leaderboard = buildLeaderboard(normalized.picks, membersById, groups, actualBracket, scoring);

  return {
    schemaVersion: 1,
    capturedAt,
    sources: {
      picks: normalized.source.source,
      matches: {
        provider: "espn",
        capturedAt: options.providerMeta?.capturedAt ?? null,
        lastSuccessfulFetchAt: options.providerMeta?.lastSuccessfulFetchAt ?? null,
        stale: options.providerMeta?.stale ?? matches.length === 0,
        message: options.providerMeta?.message ?? (matches.length === 0 ? "No live match data loaded yet." : null),
      },
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
    matches,
    groups,
    actualBracket,
    leaderboard,
    scoring,
  };
}
