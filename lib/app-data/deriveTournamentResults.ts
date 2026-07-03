import { buildLeaderboard } from "@/lib/app-data/scoring";
import { buildGroupStandings } from "@/lib/app-data/standings";
import {
  GROUP_IDS,
  ROUND_IDS,
  type ActualBracketSlot,
  type AppState,
  type Match,
  type RoundId,
  type StaticAppData,
  type TournamentResults,
} from "@/lib/schemas/appData";

export function emptyGroups(): AppState["groups"] {
  return Object.fromEntries(GROUP_IDS.map((group) => [group, []])) as unknown as AppState["groups"];
}

export function emptyActualBracket(): AppState["actualBracket"] {
  return Object.fromEntries(ROUND_IDS.map((round) => [round, []])) as unknown as AppState["actualBracket"];
}

function normalizeKnockoutRound(round: string): RoundId | null {
  const normalized = round.toLowerCase();
  if (normalized === "r32" || normalized.includes("round of 32")) return "R32";
  if (normalized === "r16" || normalized.includes("round of 16")) return "R16";
  if (normalized === "qf" || normalized.includes("quarterfinal")) return "QF";
  if (normalized === "sf" || normalized.includes("semifinal") || normalized.includes("semi-final")) return "SF";
  if (normalized === "f" || normalized.includes("final")) return "F";
  return null;
}

function buildActualBracket(matches: Match[]): AppState["actualBracket"] {
  const bracket = emptyActualBracket();
  const knockoutMatches = matches
    .filter((match) => match.stage === "knockout")
    .map((match) => ({ match, round: normalizeKnockoutRound(match.round) }))
    .filter((entry): entry is { match: Match; round: RoundId } => Boolean(entry.round));
  for (const round of ROUND_IDS) {
    bracket[round] = knockoutMatches
      .filter((entry) => entry.round === round)
      .map(({ match }, index): ActualBracketSlot => ({
        slotId: `${round}-${index + 1}`,
        round,
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

export function buildTournamentResults(staticData: StaticAppData, matches: Match[]): TournamentResults {
  const groups = buildGroupStandings(matches);
  const actualBracket = buildActualBracket(matches);
  const membersById = new Map(staticData.members.map((member) => [member.id, member.displayName]));
  const leaderboard = buildLeaderboard(staticData.picks, membersById, groups, actualBracket, staticData.scoring);
  return { groups, actualBracket, leaderboard };
}
