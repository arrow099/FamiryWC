import { GROUP_IDS, type AppState, type GroupId, type GroupStanding, type Match } from "@/lib/schemas/appData";

function emptyStanding(teamId: string): Omit<GroupStanding, "position" | "qualified" | "qualificationType"> {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

export function buildGroupStandings(matches: Match[]): AppState["groups"] {
  const groups: AppState["groups"] = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    F: [],
    G: [],
    H: [],
    I: [],
    J: [],
    K: [],
    L: [],
  };

  for (const group of GROUP_IDS) {
    const groupMatches = matches.filter((match) => match.group === group && match.status === "post" && match.homeTeamId && match.awayTeamId);
    if (groupMatches.length === 0) continue;

    const standings = new Map<string, ReturnType<typeof emptyStanding>>();
    const ensureTeam = (teamId: string) => {
      if (!standings.has(teamId)) standings.set(teamId, emptyStanding(teamId));
      return standings.get(teamId)!;
    };

    for (const match of groupMatches) {
      if (!match.homeTeamId || !match.awayTeamId || match.homeScore == null || match.awayScore == null) continue;
      const home = ensureTeam(match.homeTeamId);
      const away = ensureTeam(match.awayTeamId);
      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.won += 1;
        home.points += 3;
        away.lost += 1;
      } else if (match.homeScore < match.awayScore) {
        away.won += 1;
        away.points += 3;
        home.lost += 1;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    }

    const sorted = Array.from(standings.values())
      .map((standing) => ({
        ...standing,
        goalDifference: standing.goalsFor - standing.goalsAgainst,
      }))
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId));

    groups[group as GroupId] = sorted.map((standing, index) => ({
      ...standing,
      position: index + 1,
      qualified: index < 2,
      qualificationType: index === 0 ? "group_winner" : index === 1 ? "group_runner_up" : "unknown",
    }));
  }

  const thirdPlaceCandidates = Object.values(groups)
    .flatMap((standings) => standings.filter((standing) => standing.position === 3))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId))
    .slice(0, 8);
  const thirdPlaceIds = new Set(thirdPlaceCandidates.map((standing) => standing.teamId));

  for (const group of GROUP_IDS) {
    groups[group] = groups[group].map((standing) => {
      if (standing.position === 3 && thirdPlaceIds.has(standing.teamId)) {
        return { ...standing, qualified: true, qualificationType: "third_place" };
      }
      if (standing.position > 2 && !thirdPlaceIds.has(standing.teamId)) {
        return { ...standing, qualified: false, qualificationType: "eliminated" };
      }
      return standing;
    });
  }

  return groups;
}
