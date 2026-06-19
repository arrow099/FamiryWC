import { GROUP_IDS, ROUND_IDS } from "@/lib/schemas/appData";
import { familyPicksSchema, type FamilyPicksSource, type SourceTeam } from "@/lib/schemas/familyPicks";

const EXPECTED_ROUND_COUNTS = {
  R32: 16,
  R16: 8,
  QF: 4,
  SF: 2,
  F: 1,
} as const;

function teamKey(team: SourceTeam): string {
  return `${team.id}:${team.name}:${team.abbr}`;
}

function teamMatchesCanonical(team: SourceTeam, canonicalTeams: Map<number, SourceTeam>): boolean {
  const canonical = canonicalTeams.get(team.id);
  return Boolean(canonical && teamKey(canonical) === teamKey(team));
}

export function validateFamilyPicks(input: unknown): FamilyPicksSource {
  const source = familyPicksSchema.parse(input);
  const canonicalTeams = new Map(source.teams.map((team) => [team.id, team]));
  const errors: string[] = [];

  for (const player of source.players) {
    for (const group of GROUP_IDS) {
      const groupMap = player.groupMap[group];
      if (!groupMap) {
        errors.push(`${player.name}: missing Group ${group}`);
        continue;
      }

      const seen = new Set<number>();
      for (const position of ["1", "2", "3", "4"]) {
        const team = groupMap[position];
        if (!team) {
          errors.push(`${player.name}: missing Group ${group} position ${position}`);
          continue;
        }
        if (!teamMatchesCanonical(team, canonicalTeams)) {
          errors.push(`${player.name}: Group ${group} position ${position} does not match canonical team table`);
        }
        if (seen.has(team.id)) {
          errors.push(`${player.name}: duplicate team in Group ${group}`);
        }
        seen.add(team.id);
      }
    }

    if (player.thirdPlace.length !== 8) {
      errors.push(`${player.name}: expected 8 third-place picks`);
    }
    const thirdIds = new Set<number>();
    for (const team of player.thirdPlace) {
      if (!teamMatchesCanonical(team, canonicalTeams)) {
        errors.push(`${player.name}: third-place pick ${team.name} does not match canonical team table`);
      }
      if (thirdIds.has(team.id)) {
        errors.push(`${player.name}: duplicate third-place pick ${team.name}`);
      }
      thirdIds.add(team.id);
    }

    for (const round of ROUND_IDS) {
      const matches = player.knockout[round] ?? [];
      if (matches.length !== EXPECTED_ROUND_COUNTS[round]) {
        errors.push(`${player.name}: expected ${EXPECTED_ROUND_COUNTS[round]} ${round} matches`);
      }
      const r32TeamSlots = new Set<number>();
      for (const match of matches) {
        for (const [field, team] of [
          ["team1", match.team1],
          ["team2", match.team2],
          ["winner", match.winner],
        ] as const) {
          if (!teamMatchesCanonical(team, canonicalTeams)) {
            errors.push(`${player.name}: ${round}-${match.bracketId} ${field} does not match canonical team table`);
          }
        }
        const winnerIsValid = match.winner.id === match.team1.id || match.winner.id === match.team2.id;
        if (!winnerIsValid) {
          errors.push(`${player.name}: ${round}-${match.bracketId} winner is not in the match`);
        }
        if (round === "R32") {
          for (const team of [match.team1, match.team2]) {
            if (r32TeamSlots.has(team.id)) {
              errors.push(`${player.name}: duplicate R32 team slot ${team.name}`);
            }
            r32TeamSlots.add(team.id);
          }
        }
      }
      if (round === "R32" && r32TeamSlots.size !== 32) {
        errors.push(`${player.name}: expected 32 unique R32 team slots`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid family picks:\n${errors.join("\n")}`);
  }

  return source;
}
