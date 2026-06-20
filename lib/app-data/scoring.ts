import { GROUP_IDS, ROUND_IDS, type AppState, type GroupStanding, type LeaderboardEntry, type Pick, type ScoringRules } from "@/lib/schemas/appData";

export const DEFAULT_SCORING_RULES: ScoringRules = {
  scoringVersion: 2,
  rules: {
    groupExactPosition: 50,
    groupExactBonus: 30,
    knockoutAdvancementByRound: {
      R32: 20,
      R16: 30,
      QF: 40,
      SF: 75,
      F: 100,
    },
  },
};

function scoreGroupPicks(pick: Pick, actualGroups: AppState["groups"], rules: ScoringRules): { points: number; correct: number } {
  let points = 0;
  let correct = 0;

  for (const group of GROUP_IDS) {
    const standings = actualGroups[group] ?? [];
    const groupPicks = pick.groups[group];
    if (standings.length === 0) continue;
    const byTeam = new Map(standings.map((standing) => [standing.teamId, standing]));
    let correctInGroup = 0;

    for (const groupPick of groupPicks) {
      const actual = byTeam.get(groupPick.teamId);
      if (!actual) continue;
      if (actual.position === groupPick.position) {
        points += rules.rules.groupExactPosition;
        correct += 1;
        correctInGroup += 1;
      }
    }

    if (standings.length === groupPicks.length && correctInGroup === groupPicks.length) {
      points += rules.rules.groupExactBonus;
    }
  }

  return { points, correct };
}

function scoreKnockoutPicks(
  pick: Pick,
  actualBracket: AppState["actualBracket"],
  rules: ScoringRules,
): { points: number; pointsByRound: Record<(typeof ROUND_IDS)[number], number>; correct: number } {
  let points = 0;
  let correct = 0;
  const pointsByRound = Object.fromEntries(ROUND_IDS.map((round) => [round, 0])) as Record<(typeof ROUND_IDS)[number], number>;

  for (const round of ROUND_IDS) {
    const actualWinners = new Map((actualBracket[round] ?? []).map((slot) => [slot.slotId, slot.winnerId]));
    for (const knockoutPick of pick.knockout[round]) {
      const winnerId = actualWinners.get(knockoutPick.slotId);
      if (winnerId && winnerId === knockoutPick.winnerId) {
        const roundPoints = rules.rules.knockoutAdvancementByRound[round];
        points += roundPoints;
        pointsByRound[round] += roundPoints;
        correct += 1;
      }
    }
  }

  return { points, pointsByRound, correct };
}

export function buildLeaderboard(
  picks: Pick[],
  membersById: Map<string, string>,
  actualGroups: Record<string, GroupStanding[]>,
  actualBracket: AppState["actualBracket"],
  rules: ScoringRules,
): LeaderboardEntry[] {
  const entries = picks.map((pick) => {
    const groupScore = scoreGroupPicks(pick, actualGroups as AppState["groups"], rules);
    const knockoutScore = scoreKnockoutPicks(pick, actualBracket, rules);
    const totalPoints = groupScore.points + knockoutScore.points;

    return {
      rank: 0,
      memberId: pick.memberId,
      displayName: membersById.get(pick.memberId) ?? pick.memberId,
      totalPoints,
      groupPoints: groupScore.points,
      knockoutPoints: knockoutScore.points,
      knockoutPointsByRound: knockoutScore.pointsByRound,
      championPick: pick.championPick,
      possiblePointsRemaining: null,
      correctPicks: {
        groups: groupScore.correct,
        knockout: knockoutScore.correct,
      },
    };
  });

  entries.sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName));

  let previousPoints: number | null = null;
  let previousRank = 0;
  return entries.map((entry, index) => {
    const rank = previousPoints === entry.totalPoints ? previousRank : index + 1;
    previousPoints = entry.totalPoints;
    previousRank = rank;
    return { ...entry, rank };
  });
}
