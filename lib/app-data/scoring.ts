import { GROUP_IDS, ROUND_IDS, type AppState, type GroupStanding, type LeaderboardEntry, type Pick, type ScoringRules } from "@/lib/schemas/appData";

export const DEFAULT_SCORING_RULES: ScoringRules = {
  scoringVersion: 1,
  rules: {
    groupExactPosition: 2,
    groupQualified: 1,
    thirdPlaceAdvanced: 2,
    knockoutWinnerByRound: {
      R32: 2,
      R16: 4,
      QF: 6,
      SF: 8,
      F: 12,
    },
    champion: 10,
  },
};

function scoreGroupPicks(pick: Pick, actualGroups: AppState["groups"], rules: ScoringRules): { points: number; correct: number } {
  let points = 0;
  let correct = 0;

  for (const group of GROUP_IDS) {
    const standings = actualGroups[group] ?? [];
    if (standings.length === 0) continue;
    const byTeam = new Map(standings.map((standing) => [standing.teamId, standing]));
    const qualifiedIds = new Set(standings.filter((standing) => standing.qualified).map((standing) => standing.teamId));

    for (const groupPick of pick.groups[group]) {
      const actual = byTeam.get(groupPick.teamId);
      if (!actual) continue;
      if (actual.position === groupPick.position) {
        points += rules.rules.groupExactPosition;
        correct += 1;
      } else if (groupPick.position <= 2 && qualifiedIds.has(groupPick.teamId)) {
        points += rules.rules.groupQualified;
      }
    }
  }

  return { points, correct };
}

function scoreThirdPlacePicks(pick: Pick, actualGroups: AppState["groups"], rules: ScoringRules): { points: number; correct: number } {
  const actualThirdPlace = new Set<string>();
  for (const standings of Object.values(actualGroups)) {
    for (const standing of standings) {
      if (standing.qualificationType === "third_place" && standing.qualified) {
        actualThirdPlace.add(standing.teamId);
      }
    }
  }

  if (actualThirdPlace.size === 0) {
    return { points: 0, correct: 0 };
  }

  let correct = 0;
  for (const teamId of pick.thirdPlaceAdvancers) {
    if (actualThirdPlace.has(teamId)) correct += 1;
  }

  return { points: correct * rules.rules.thirdPlaceAdvanced, correct };
}

function scoreKnockoutPicks(pick: Pick, actualBracket: AppState["actualBracket"], rules: ScoringRules): { points: number; correct: number; championBonus: number } {
  let points = 0;
  let correct = 0;
  let championBonus = 0;

  for (const round of ROUND_IDS) {
    const actualWinners = new Map((actualBracket[round] ?? []).map((slot) => [slot.slotId, slot.winnerId]));
    for (const knockoutPick of pick.knockout[round]) {
      const winnerId = actualWinners.get(knockoutPick.slotId);
      if (winnerId && winnerId === knockoutPick.winnerId) {
        points += rules.rules.knockoutWinnerByRound[round];
        correct += 1;
        if (round === "F" && pick.championPick === winnerId) {
          championBonus += rules.rules.champion;
        }
      }
    }
  }

  return { points, correct, championBonus };
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
    const thirdScore = scoreThirdPlacePicks(pick, actualGroups as AppState["groups"], rules);
    const knockoutScore = scoreKnockoutPicks(pick, actualBracket, rules);
    const totalPoints = groupScore.points + thirdScore.points + knockoutScore.points + knockoutScore.championBonus;

    return {
      rank: 0,
      memberId: pick.memberId,
      displayName: membersById.get(pick.memberId) ?? pick.memberId,
      totalPoints,
      groupPoints: groupScore.points,
      thirdPlacePoints: thirdScore.points,
      knockoutPoints: knockoutScore.points,
      championBonus: knockoutScore.championBonus,
      championPick: pick.championPick,
      possiblePointsRemaining: null,
      correctPicks: {
        groups: groupScore.correct,
        thirdPlace: thirdScore.correct,
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
