import type { EspnMatchStatsSummary, EspnPlayerStats, EspnStatValue, EspnTeamStats } from "@/lib/providers/espn";
import { teamIdFromAbbr } from "@/lib/app-data/ids";
import type { Match } from "@/lib/schemas/appData";

export type StatsHighlight = {
  id: string;
  scope: "tournament" | "live";
  category: "team" | "player" | "match";
  title: string;
  subject: string;
  teamId: string | null;
  teamAbbr: string | null;
  valueLabel: string;
  detail: string;
  evidence: string;
  matchId: string;
  eventId: string;
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
  tournamentHighlights: StatsHighlight[];
  liveHighlights: StatsHighlight[];
  playerLeaderboards: Record<string, StatsLeaderboardRow[]>;
  teamLeaderboards: Record<string, StatsLeaderboardRow[]>;
};

const PLAYER_STAT_LABELS: Record<string, string> = {
  totalGoals: "Goals",
  goalAssists: "Assists",
  totalShots: "Shots",
  shotsOnTarget: "Shots on target",
  saves: "Saves",
  accuratePasses: "Accurate passes",
  foulsCommitted: "Fouls",
};

const TEAM_STAT_LABELS: Record<string, string> = {
  totalShots: "Shots",
  shotsOnTarget: "Shots on target",
  saves: "Saves",
  possessionPct: "Possession",
  accuratePasses: "Accurate passes",
  cornerKicks: "Corners",
  fouls: "Fouls",
  tackles: "Tackles",
  interceptions: "Interceptions",
  clearances: "Clearances",
};

const HIGHLIGHT_STATS = new Set([
  "totalGoals",
  "goalAssists",
  "totalShots",
  "shotsOnTarget",
  "saves",
  "accuratePasses",
  "possessionPct",
  "cornerKicks",
]);

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

  return {
    tournamentHighlights: buildTournamentHighlights(completedCandidates),
    liveHighlights: liveMatches.flatMap((match) => buildLiveHighlights(match, summaryByEventId.get(match.providerIds.espn!)!)).slice(0, 6),
    playerLeaderboards: withGoalsLeaderboard(
      buildAggregatePlayerGoals(completedCandidates),
      buildLeaderboards(completedCandidates.filter((candidate) => candidate.category === "player" && candidate.statKey !== "totalGoals")),
    ),
    teamLeaderboards: withGoalsLeaderboard(
      buildAggregateTeamGoals(completedMatches),
      buildLeaderboards(completedCandidates.filter((candidate) => candidate.category === "team")),
    ),
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
      subject: team.teamAbbr ?? team.teamName ?? "Team",
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

function buildTournamentHighlights(candidates: RankedCandidate[]): StatsHighlight[] {
  const topByStat = [...groupCandidates(candidates.filter((candidate) => HIGHLIGHT_STATS.has(candidate.statKey))).entries()]
    .flatMap(([, statCandidates]) => statCandidates.sort(sortCandidates).slice(0, 1));

  return topByStat
    .sort((a, b) => highlightPriority(b) - highlightPriority(a))
    .slice(0, 8)
    .map((candidate, index) => highlightForCandidate(candidate, "tournament", index));
}

function buildLiveHighlights(match: Match, summary: EspnMatchStatsSummary): StatsHighlight[] {
  const candidates = candidatesForMatch(match, summary)
    .filter((candidate) => HIGHLIGHT_STATS.has(candidate.statKey))
    .sort((a, b) => highlightPriority(b) - highlightPriority(a) || sortCandidates(a, b))
    .slice(0, 3);

  return candidates.map((candidate, index) => highlightForCandidate(candidate, "live", index));
}

function buildLeaderboards(candidates: RankedCandidate[]): Record<string, StatsLeaderboardRow[]> {
  const rows: Record<string, StatsLeaderboardRow[]> = {};
  for (const [statKey, statCandidates] of groupCandidates(candidates)) {
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
      statLabel: "Goals",
      value: (current?.value ?? 0) + candidate.value,
      valueLabel: String((current?.value ?? 0) + candidate.value),
      matchLabel: "Tournament total",
    });
  }

  return [...totals.values()].sort(sortLeaderboardRows).slice(0, 10);
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
    statLabel: "Goals",
    value,
    valueLabel: String(value),
    matchLabel: "Tournament total",
  });
}

function sortLeaderboardRows(a: StatsLeaderboardRow, b: StatsLeaderboardRow): number {
  return b.value - a.value || a.subject.localeCompare(b.subject);
}

function withGoalsLeaderboard(goals: StatsLeaderboardRow[], leaderboards: Record<string, StatsLeaderboardRow[]>): Record<string, StatsLeaderboardRow[]> {
  return goals.length > 0 ? { totalGoals: goals, ...leaderboards } : leaderboards;
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

function highlightForCandidate(candidate: RankedCandidate, scope: StatsHighlight["scope"], index: number): StatsHighlight {
  const label = scope === "live" ? "Live standout" : "Best so far";
  const scoreLine = `${candidate.match.homeScore ?? 0}-${candidate.match.awayScore ?? 0}`;
  const scoringEvidence = candidate.summary.scoringPlays[0];

  return {
    id: `${scope}-${candidate.statKey}-${candidate.summary.eventId}-${index}`,
    scope,
    category: candidate.category,
    title: `${label}: ${candidate.statLabel}`,
    subject: candidate.subject,
    teamId: candidate.teamId,
    teamAbbr: candidate.teamAbbr,
    valueLabel: candidate.valueLabel,
    detail: `${candidate.subject} has ${candidate.valueLabel} ${candidate.statLabel.toLowerCase()} in ${matchLabel(candidate.match)}.`,
    evidence: scoringEvidence
      ? `${scoreLine}; scoring note ${scoringEvidence.clock || "FT"} ${scoringEvidence.text}`
      : `${scoreLine}; ESPN boxscore stat`,
    matchId: candidate.match.id,
    eventId: candidate.summary.eventId,
  };
}

function knownStatsTeamId(abbr: string | null): string | null {
  return abbr ? teamIdFromAbbr(abbr) : null;
}

function sortCandidates(a: RankedCandidate, b: RankedCandidate): number {
  return b.value - a.value || matchLabel(a.match).localeCompare(matchLabel(b.match)) || a.subject.localeCompare(b.subject);
}

function highlightPriority(candidate: RankedCandidate): number {
  const multiplier = candidate.statKey === "totalGoals" || candidate.statKey === "saves" ? 10 : 1;
  return candidate.value * multiplier;
}

function displayValue(stat: EspnStatValue): string {
  return stat.displayValue || String(stat.value ?? "");
}

function matchLabel(match: Match): string {
  const home = match.homeTeamName ?? match.homeTeamId ?? "Home";
  const away = match.awayTeamName ?? match.awayTeamId ?? "Away";
  return `${home} vs ${away}`;
}
