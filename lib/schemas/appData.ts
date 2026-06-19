export const GROUP_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
export const ROUND_IDS = ["R32", "R16", "QF", "SF", "F"] as const;

export type GroupId = (typeof GROUP_IDS)[number];
export type RoundId = (typeof ROUND_IDS)[number];
export type MatchStatus = "pre" | "in" | "post" | "postponed" | "cancelled" | "unknown";
export type QualificationType = "group_winner" | "group_runner_up" | "third_place" | "eliminated" | "unknown";

export type Team = {
  id: string;
  name: string;
  abbr: string;
  providerIds: {
    local: number;
    espn: string | null;
    fifa: string | null;
  };
};

export type Member = {
  id: string;
  displayName: string;
  sourceName: string;
};

export type GroupPick = {
  position: number;
  teamId: string;
};

export type KnockoutPick = {
  slotId: string;
  round: RoundId;
  bracketId: number;
  team1Id: string;
  team2Id: string;
  winnerId: string;
};

export type Pick = {
  memberId: string;
  groups: Record<GroupId, GroupPick[]>;
  thirdPlaceAdvancers: string[];
  knockout: Record<RoundId, KnockoutPick[]>;
  championPick: string | null;
};

export type Match = {
  id: string;
  providerIds: {
    espn: string | null;
  };
  stage: "group" | "knockout" | "unknown";
  round: string;
  group: GroupId | null;
  kickoffAt: string | null;
  status: MatchStatus;
  statusText: string;
  clock: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  venue: {
    name: string | null;
    city: string | null;
    country: string | null;
  };
};

export type GroupStanding = {
  teamId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  qualified: boolean;
  qualificationType: QualificationType;
};

export type ActualBracketSlot = {
  slotId: string;
  round: RoundId;
  bracketId: number;
  matchId: string | null;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  status: MatchStatus;
};

export type ScoringRules = {
  scoringVersion: number;
  rules: {
    groupExactPosition: number;
    groupQualified: number;
    thirdPlaceAdvanced: number;
    knockoutWinnerByRound: Record<RoundId, number>;
    champion: number;
  };
};

export type LeaderboardEntry = {
  rank: number;
  memberId: string;
  displayName: string;
  totalPoints: number;
  groupPoints: number;
  thirdPlacePoints: number;
  knockoutPoints: number;
  championBonus: number;
  championPick: string | null;
  possiblePointsRemaining: number | null;
  correctPicks: {
    groups: number;
    thirdPlace: number;
    knockout: number;
  };
};

export type AppState = {
  schemaVersion: 1;
  capturedAt: string;
  sources: {
    picks: unknown;
    matches: {
      provider: "espn";
      capturedAt: string | null;
      lastSuccessfulFetchAt: string | null;
      stale: boolean;
      message: string | null;
    };
  };
  league: {
    name: string;
    year: number;
    playerCount: number;
    teamCount: number;
    groupCount: number;
    rounds: RoundId[];
  };
  teams: Team[];
  members: Member[];
  picks: Pick[];
  matches: Match[];
  groups: Record<GroupId, GroupStanding[]>;
  actualBracket: Record<RoundId, ActualBracketSlot[]>;
  leaderboard: LeaderboardEntry[];
  scoring: ScoringRules;
};
