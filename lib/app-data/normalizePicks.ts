import { teamIdFromAbbr, slug } from "@/lib/app-data/ids";
import { validateFamilyPicks } from "@/lib/app-data/validateFamilyPicks";
import { GROUP_IDS, ROUND_IDS, type Member, type Pick, type Team } from "@/lib/schemas/appData";
import type { FamilyPicksSource } from "@/lib/schemas/familyPicks";

export function normalizeTeams(source: FamilyPicksSource): Team[] {
  return source.teams.map((team) => ({
    id: teamIdFromAbbr(team.abbr),
    name: team.name,
    abbr: team.abbr,
    providerIds: {
      local: team.id,
      espn: null,
      fifa: null,
    },
  }));
}

export function normalizeMembers(source: FamilyPicksSource): Member[] {
  const seen = new Map<string, number>();
  return source.players.map((player) => {
    const displayName = player.name.trim();
    const baseSlug = slug(displayName);
    const count = seen.get(baseSlug) ?? 0;
    seen.set(baseSlug, count + 1);
    return {
      id: count === 0 ? `member_${baseSlug}` : `member_${baseSlug}_${count + 1}`,
      displayName,
      sourceName: player.name,
    };
  });
}

export function normalizePicks(input: unknown): { source: FamilyPicksSource; teams: Team[]; members: Member[]; picks: Pick[] } {
  const source = validateFamilyPicks(input);
  const teams = normalizeTeams(source);
  const members = normalizeMembers(source);

  const picks = source.players.map((player, playerIndex): Pick => {
    const groups = Object.fromEntries(
      GROUP_IDS.map((group) => [
        group,
        [1, 2, 3, 4].map((position) => ({
          position,
          teamId: teamIdFromAbbr(player.groupMap[group][String(position)].abbr),
        })),
      ]),
    ) as Pick["groups"];

    const knockout = Object.fromEntries(
      ROUND_IDS.map((round) => [
        round,
        (player.knockout[round] ?? []).map((match) => ({
          slotId: `${round}-${match.bracketId}`,
          round,
          bracketId: match.bracketId,
          team1Id: teamIdFromAbbr(match.team1.abbr),
          team2Id: teamIdFromAbbr(match.team2.abbr),
          winnerId: teamIdFromAbbr(match.winner.abbr),
        })),
      ]),
    ) as Pick["knockout"];

    return {
      memberId: members[playerIndex].id,
      groups,
      thirdPlaceAdvancers: player.thirdPlace.map((team) => teamIdFromAbbr(team.abbr)),
      knockout,
      championPick: knockout.F[0]?.winnerId ?? null,
    };
  });

  return { source, teams, members, picks };
}
