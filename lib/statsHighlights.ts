import type { EspnMatchStatsSummary, EspnPlayerStats, EspnStatValue, EspnTeamStats } from "@/lib/providers/espn";
import { teamIdFromAbbr } from "@/lib/app-data/ids";
import type { Match } from "@/lib/schemas/appData";

export type StatsLiveStatCard = {
  id: string;
  title: string;
  matchId: string;
  eventId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeValueLabel: string;
  awayValueLabel: string;
};

export type StatsLiveMatchGroup = {
  matchId: string;
  eventId: string;
  matchLabel: string;
  cards: StatsLiveStatCard[];
};

export type StatsLeaderboardRow = {
  id: string;
  subject: string;
  teamId: string | null;
  teamAbbr: string | null;
  statLabel: string;
  value: number;
  valueLabel: string;
  matchLabel: string;
};

export type StatsDashboardData = {
  liveMatchStats: StatsLiveMatchGroup[];
  tournamentHighlights: Record<string, StatsLeaderboardRow[]>;
};

const PLAYER_STAT_LABELS: Record<string, string> = {
  totalGoals: "Goals",
  shotsOnTarget: "Shots on target",
};

const TEAM_STAT_LABELS: Record<string, string> = {
  shotsOnTarget: "Shots on target",
  cornerKicks: "Corners",
};

const PLAYER_LEADERBOARD_ORDER = [
  "shotsOnTarget",
] as const;

const TEAM_LEADERBOARD_ORDER = [
  "shotsOnTarget",
  "cornerKicks",
] as const;

const LIVE_TEAM_STAT_LABELS: Record<string, string> = {
  shotsOnTarget: "Shots on target",
  yellowCards: "Yellow cards",
  redCards: "Red cards",
};

const LIVE_TEAM_STAT_ORDER = [
  "shotsOnTarget",
] as const;

type RankedCandidate = {
  category: "team" | "player";
  statKey: string;
  statLabel: string;
  subject: string;
  teamId: string | null;
  teamAbbr: string | null;
  value: number;
  valueLabel: string;
  match: Match;
  summary: EspnMatchStatsSummary;
};

export function buildStatsDashboardData(matches: Match[], summaries: EspnMatchStatsSummary[]): StatsDashboardData {
  const summaryByEventId = new Map(summaries.map((summary) => [summary.eventId, summary]));
  const completedMatches = matches.filter((match) => match.status === "post" && match.providerIds.espn && summaryByEventId.has(match.providerIds.espn));
  const liveMatches = matches.filter((match) => match.status === "in" && match.providerIds.espn && summaryByEventId.has(match.providerIds.espn));
  const completedCandidates = completedMatches.flatMap((match) => candidatesForMatch(match, summaryByEventId.get(match.providerIds.espn!)!));
  const playerHighlights = withGoalLeaderboards(
    buildAggregatePlayerGoals(completedCandidates),
    buildSingleMatchPlayerGoals(completedCandidates),
    buildOrderedLeaderboards(
      completedCandidates.filter((candidate) => candidate.category === "player" && PLAYER_LEADERBOARD_ORDER.includes(candidate.statKey as typeof PLAYER_LEADERBOARD_ORDER[number])),
      PLAYER_LEADERBOARD_ORDER,
    ),
  );
  const teamHighlights = withGoalLeaderboards(
    buildAggregateTeamGoals(completedMatches),
    buildSingleMatchTeamGoals(completedMatches),
    buildOrderedLeaderboards(
      completedCandidates.filter((candidate) => candidate.category === "team" && TEAM_LEADERBOARD_ORDER.includes(candidate.statKey as typeof TEAM_LEADERBOARD_ORDER[number])),
      TEAM_LEADERBOARD_ORDER,
    ),
  );

  return {
    liveMatchStats: liveMatches.map((match) => buildLiveMatchStats(match, summaryByEventId.get(match.providerIds.espn!)!)),
    tournamentHighlights: buildTournamentHighlights(playerHighlights, teamHighlights),
  };
}

function candidatesForMatch(match: Match, summary: EspnMatchStatsSummary): RankedCandidate[] {
  return [
    ...summary.teamStats.flatMap((team) => statCandidatesForTeam(match, summary, team)),
    ...summary.playerStats.flatMap((player) => statCandidatesForPlayer(match, summary, player)),
  ];
}

function statCandidatesForTeam(match: Match, summary: EspnMatchStatsSummary, team: EspnTeamStats): RankedCandidate[] {
  return team.stats.flatMap((stat) => {
    if (!TEAM_STAT_LABELS[stat.key] || stat.value == null) return [];
    return [{
      category: "team" as const,
      statKey: stat.key,
      statLabel: TEAM_STAT_LABELS[stat.key] ?? stat.label,
      subject: team.teamName ?? team.teamAbbr ?? "Team",
      teamId: knownStatsTeamId(team.teamAbbr),
      teamAbbr: team.teamAbbr,
      value: stat.value,
      valueLabel: displayValue(stat),
      match,
      summary,
    }];
  });
}

function statCandidatesForPlayer(match: Match, summary: EspnMatchStatsSummary, player: EspnPlayerStats): RankedCandidate[] {
  return player.stats.flatMap((stat) => {
    if (!PLAYER_STAT_LABELS[stat.key] || stat.value == null || stat.value <= 0) return [];
    return [{
      category: "player" as const,
      statKey: stat.key,
      statLabel: PLAYER_STAT_LABELS[stat.key] ?? stat.label,
      subject: player.playerName,
      teamId: knownStatsTeamId(player.teamAbbr),
      teamAbbr: player.teamAbbr,
      value: stat.value,
      valueLabel: displayValue(stat),
      match,
      summary,
    }];
  });
}

function buildLiveMatchStats(match: Match, summary: EspnMatchStatsSummary): StatsLiveMatchGroup {
  const homeStats = teamStatsForMatchSide(summary.teamStats, match.homeTeamName, 0);
  const awayStats = teamStatsForMatchSide(summary.teamStats, match.awayTeamName, 1);
  const cards: StatsLiveStatCard[] = [{
    id: `live-score-${match.providerIds.espn ?? match.id}`,
    title: "Score",
    matchId: match.id,
    eventId: summary.eventId,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeTeamName: match.homeTeamName ?? "Home",
    awayTeamName: match.awayTeamName ?? "Away",
    homeValueLabel: String(match.homeScore ?? 0),
    awayValueLabel: String(match.awayScore ?? 0),
  }];

  for (const statKey of LIVE_TEAM_STAT_ORDER) {
    const homeStat = statValue(homeStats, statKey);
    const awayStat = statValue(awayStats, statKey);
    if (!homeStat && !awayStat) continue;
    cards.push({
      id: `live-${statKey}-${match.providerIds.espn ?? match.id}`,
      title: LIVE_TEAM_STAT_LABELS[statKey],
      matchId: match.id,
      eventId: summary.eventId,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeTeamName: match.homeTeamName ?? homeStats?.teamName ?? "Home",
      awayTeamName: match.awayTeamName ?? awayStats?.teamName ?? "Away",
      homeValueLabel: homeStat?.displayValue ?? "-",
      awayValueLabel: awayStat?.displayValue ?? "-",
    });
  }

  const homeYellow = statValue(homeStats, "yellowCards");
  const awayYellow = statValue(awayStats, "yellowCards");
  const homeRed = statValue(homeStats, "redCards");
  const awayRed = statValue(awayStats, "redCards");
  if (homeYellow || awayYellow || homeRed || awayRed) {
    cards.push({
      id: `live-cards-${match.providerIds.espn ?? match.id}`,
      title: "Cards",
      matchId: match.id,
      eventId: summary.eventId,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeTeamName: match.homeTeamName ?? homeStats?.teamName ?? "Home",
      awayTeamName: match.awayTeamName ?? awayStats?.teamName ?? "Away",
      homeValueLabel: cardValue(homeYellow, homeRed),
      awayValueLabel: cardValue(awayYellow, awayRed),
    });
  }

  return {
    matchId: match.id,
    eventId: summary.eventId,
    matchLabel: matchLabel(match),
    cards,
  };
}

function buildOrderedLeaderboards(candidates: RankedCandidate[], statOrder: readonly string[]): Record<string, StatsLeaderboardRow[]> {
  const rows: Record<string, StatsLeaderboardRow[]> = {};
  const grouped = groupCandidates(candidates);
  for (const statKey of statOrder) {
    const statCandidates = grouped.get(statKey);
    if (!statCandidates) continue;
    rows[statKey] = statCandidates.sort(sortCandidates).slice(0, 5).map((candidate) => ({
      id: `${candidate.category}-${statKey}-${candidate.summary.eventId}-${candidate.subject}`,
      subject: candidate.subject,
      teamId: candidate.teamId,
      teamAbbr: candidate.teamAbbr,
      statLabel: candidate.statLabel,
      value: candidate.value,
      valueLabel: candidate.valueLabel,
      matchLabel: matchLabel(candidate.match),
    }));
  }
  return rows;
}

function buildAggregatePlayerGoals(candidates: RankedCandidate[]): StatsLeaderboardRow[] {
  const totals = new Map<string, StatsLeaderboardRow>();
  for (const candidate of candidates) {
    if (candidate.category !== "player" || candidate.statKey !== "totalGoals") continue;
    const id = `${candidate.subject}-${candidate.teamAbbr ?? ""}`;
    const current = totals.get(id);
    totals.set(id, {
      id: `player-total-goals-${id}`,
      subject: candidate.subject,
      teamId: candidate.teamId,
      teamAbbr: candidate.teamAbbr,
      statLabel: "Tournament Goals",
      value: (current?.value ?? 0) + candidate.value,
      valueLabel: String((current?.value ?? 0) + candidate.value),
      matchLabel: "Tournament total",
    });
  }

  return [...totals.values()].sort(sortLeaderboardRows).slice(0, 10);
}

function buildSingleMatchPlayerGoals(candidates: RankedCandidate[]): StatsLeaderboardRow[] {
  return candidates
    .filter((candidate) => candidate.category === "player" && candidate.statKey === "totalGoals")
    .sort(sortCandidates)
    .slice(0, 10)
    .map((candidate) => ({
      id: `player-single-match-goals-${candidate.summary.eventId}-${candidate.subject}`,
      subject: candidate.subject,
      teamId: candidate.teamId,
      teamAbbr: candidate.teamAbbr,
      statLabel: "Single Match Goals",
      value: candidate.value,
      valueLabel: candidate.valueLabel,
      matchLabel: matchLabel(candidate.match),
    }));
}

function buildAggregateTeamGoals(matches: Match[]): StatsLeaderboardRow[] {
  const totals = new Map<string, StatsLeaderboardRow>();
  for (const match of matches) {
    addTeamGoals(totals, match.homeTeamId ?? match.homeTeamName ?? "home", match.homeTeamName ?? match.homeTeamId ?? "Home", match.homeTeamId, match.homeScore);
    addTeamGoals(totals, match.awayTeamId ?? match.awayTeamName ?? "away", match.awayTeamName ?? match.awayTeamId ?? "Away", match.awayTeamId, match.awayScore);
  }

  return [...totals.values()].sort(sortLeaderboardRows).slice(0, 10);
}

function addTeamGoals(totals: Map<string, StatsLeaderboardRow>, id: string, subject: string, teamId: string | null, goals: number | null) {
  if (goals == null) return;
  const current = totals.get(id);
  const value = (current?.value ?? 0) + goals;
  totals.set(id, {
    id: `team-total-goals-${id}`,
    subject,
    teamId,
    teamAbbr: null,
    statLabel: "Tournament Goals",
    value,
    valueLabel: String(value),
    matchLabel: "Tournament total",
  });
}

function buildSingleMatchTeamGoals(matches: Match[]): StatsLeaderboardRow[] {
  return matches.flatMap((match) => [
    teamGoalRow(match, "home", match.homeTeamId, match.homeTeamName, match.homeScore),
    teamGoalRow(match, "away", match.awayTeamId, match.awayTeamName, match.awayScore),
  ])
    .flatMap((row) => row ? [row] : [])
    .sort(sortLeaderboardRows)
    .slice(0, 10);
}

function teamGoalRow(match: Match, side: "home" | "away", teamId: string | null, teamName: string | null, goals: number | null): StatsLeaderboardRow | null {
  if (goals == null) return null;
  return {
    id: `team-single-match-goals-${match.id}-${side}`,
    subject: teamName ?? teamId ?? "Team",
    teamId,
    teamAbbr: null,
    statLabel: "Single Match Goals",
    value: goals,
    valueLabel: String(goals),
    matchLabel: matchLabel(match),
  };
}

function sortLeaderboardRows(a: StatsLeaderboardRow, b: StatsLeaderboardRow): number {
  return b.value - a.value || a.subject.localeCompare(b.subject);
}

function withGoalLeaderboards(tournamentGoals: StatsLeaderboardRow[], singleMatchGoals: StatsLeaderboardRow[], leaderboards: Record<string, StatsLeaderboardRow[]>): Record<string, StatsLeaderboardRow[]> {
  return {
    ...(tournamentGoals.length > 0 ? { tournamentGoals } : {}),
    ...(singleMatchGoals.length > 0 ? { singleMatchGoals } : {}),
    ...leaderboards,
  };
}

function buildTournamentHighlights(playerHighlights: Record<string, StatsLeaderboardRow[]>, teamHighlights: Record<string, StatsLeaderboardRow[]>): Record<string, StatsLeaderboardRow[]> {
  return {
    ...(playerHighlights.tournamentGoals?.length ? { playerTournamentGoals: relabelRows(playerHighlights.tournamentGoals, "Player goals") } : {}),
    ...(teamHighlights.tournamentGoals?.length ? { teamTournamentGoals: relabelRows(teamHighlights.tournamentGoals, "Team goals") } : {}),
    ...(playerHighlights.singleMatchGoals?.length ? { playerSingleMatchGoals: relabelRows(playerHighlights.singleMatchGoals, "Single-match player goals") } : {}),
    ...(teamHighlights.singleMatchGoals?.length ? { teamSingleMatchGoals: relabelRows(teamHighlights.singleMatchGoals, "Single-match team goals") } : {}),
    ...(playerHighlights.shotsOnTarget?.length ? { playerShotsOnTarget: relabelRows(playerHighlights.shotsOnTarget, "Player shots on target") } : {}),
    ...(teamHighlights.shotsOnTarget?.length ? { teamShotsOnTarget: relabelRows(teamHighlights.shotsOnTarget, "Team shots on target") } : {}),
    ...(teamHighlights.cornerKicks?.length ? { corners: relabelRows(teamHighlights.cornerKicks, "Corners") } : {}),
  };
}

function relabelRows(rows: StatsLeaderboardRow[], statLabel: string): StatsLeaderboardRow[] {
  return rows.map((row) => ({ ...row, statLabel }));
}

function teamStatsForMatchSide(teamStats: EspnTeamStats[], teamName: string | null, fallbackIndex: number): EspnTeamStats | null {
  if (!teamName) return teamStats[fallbackIndex] ?? null;
  return teamStats.find((team) => team.teamName === teamName || teamName.includes(team.teamName ?? "")) ?? teamStats[fallbackIndex] ?? null;
}

function statValue(teamStats: EspnTeamStats | null, key: string): EspnStatValue | null {
  return teamStats?.stats.find((stat) => stat.key === key) ?? null;
}

function cardValue(yellowCards: EspnStatValue | null, redCards: EspnStatValue | null): string {
  const yellow = Number(yellowCards?.value ?? 0);
  const red = Number(redCards?.value ?? 0);
  const yellowLabel = yellow > 0 ? `${"🟨".repeat(yellow)} ${yellow}` : "0";
  const redLabel = red > 0 ? `${"🟥".repeat(red)} ${red}` : "0";
  return `${yellowLabel} / ${redLabel}`;
}

function groupCandidates(candidates: RankedCandidate[]): Map<string, RankedCandidate[]> {
  const grouped = new Map<string, RankedCandidate[]>();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.statKey) ?? [];
    existing.push(candidate);
    grouped.set(candidate.statKey, existing);
  }
  return grouped;
}

function knownStatsTeamId(abbr: string | null): string | null {
  return abbr ? teamIdFromAbbr(abbr) : null;
}

function sortCandidates(a: RankedCandidate, b: RankedCandidate): number {
  return b.value - a.value || matchLabel(a.match).localeCompare(matchLabel(b.match)) || a.subject.localeCompare(b.subject);
}

function displayValue(stat: EspnStatValue): string {
  return stat.displayValue || String(stat.value ?? "");
}

function matchLabel(match: Match): string {
  const home = match.homeTeamName ?? match.homeTeamId ?? "Home";
  const away = match.awayTeamName ?? match.awayTeamId ?? "Away";
  return `${home} vs ${away}`;
}
