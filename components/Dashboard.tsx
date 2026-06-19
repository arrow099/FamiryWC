"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  AppBar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { useEspnLiveMatches } from "@/hooks/useEspnLiveMatches";
import { buildTournamentResults, emptyActualBracket, emptyGroups } from "@/lib/app-data/deriveTournamentResults";
import { flagForTeam, formatTeamLabel } from "@/lib/app-data/teamDisplay";
import type { AppState, GroupId, KnockoutPick, Match, Pick, RoundId, StaticAppData, Team } from "@/lib/schemas/appData";
import { GROUP_IDS, ROUND_IDS } from "@/lib/schemas/appData";

type MatchStatusChipColor = "default" | "error" | "success" | "warning";
type ScheduleFilter = "today" | "upcoming" | "past" | "all";

const TAB_LABELS = ["Overview", "Participants", "Groups", "Knockout", "Schedule", "Compare", "Leaderboard"] as const;
const TAB_DESCRIPTIONS = [
  "Tournament consensus and league-wide trends",
  "Everyone in the pool and their champion pick",
  "Review each participant's group-stage predictions",
  "Follow every participant's path to the trophy",
  "Live, upcoming, and completed tournament matches",
  "See where two brackets agree and diverge",
  "Current points and scoring breakdown",
] as const;
const BRACKET_ROUND_LABELS: Record<RoundId, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  F: "Final",
};
const BRACKET_CARD_WIDTH = 132;
const BRACKET_COLUMN_GAP = 8;
const BRACKET_SIDE_MIN_WIDTH = BRACKET_CARD_WIDTH * 4 + BRACKET_COLUMN_GAP * 3;
const BRACKET_FINAL_LANE_WIDTH = BRACKET_CARD_WIDTH + 72;
const BRACKET_ROW_HEIGHT = 86;
const BRACKET_SIDE_ROWS = 8;
const MATCH_FINAL_DISPLAY_DELAY_MS = 2.5 * 60 * 60 * 1000;
const SCHEDULE_FILTERS: Array<{ label: string; value: ScheduleFilter }> = [
  { label: "Today", value: "today" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
  { label: "All", value: "all" },
];

function teamLabelText(teamMap: Map<string, Team>, teamId: string | null | undefined): string {
  if (!teamId) return "-";
  const team = teamMap.get(teamId);
  return team ? formatTeamLabel(team) : teamId;
}

function teamListText(teamMap: Map<string, Team>, teamIds: Array<string | null | undefined>): string {
  const labels = teamIds.filter(Boolean).map((teamId) => teamLabelText(teamMap, teamId));
  return labels.length > 0 ? labels.join(", ") : "-";
}

function sameSet(a: Array<string | null | undefined>, b: Array<string | null | undefined>): boolean {
  const left = new Set(a.filter(Boolean));
  const right = new Set(b.filter(Boolean));
  return left.size === right.size && Array.from(left).every((value) => right.has(value));
}

function finalistIds(pick: Pick): string[] {
  const final = pick.knockout.F[0];
  return final ? [final.team1Id, final.team2Id] : [];
}

function roundTeamIds(pick: Pick, round: "QF" | "SF"): string[] {
  return pick.knockout[round].flatMap((match) => [match.team1Id, match.team2Id]);
}

function groupByTeamId(pick: Pick): Map<string, GroupId> {
  const groups = new Map<string, GroupId>();
  for (const group of GROUP_IDS) {
    for (const groupPick of pick.groups[group]) {
      groups.set(groupPick.teamId, group);
    }
  }
  return groups;
}

function TeamLabel({ teamMap, teamId }: { teamMap: Map<string, Team>; teamId: string | null | undefined }) {
  if (!teamId) return "-";
  const team = teamMap.get(teamId);
  if (!team) return teamId;

  return (
    <Stack component="span" direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, whiteSpace: "nowrap" }}>
      <Box component="span" aria-hidden="true" title={`${team.abbr} flag`} sx={{ fontSize: "1.05em", lineHeight: 1 }}>
        {flagForTeam(team)}
      </Box>
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: 0 }}>
        {team.abbr}
      </Box>
    </Stack>
  );
}

function MatchTeamLabel({ teamMap, teamId, fallbackName }: { teamMap: Map<string, Team>; teamId: string | null | undefined; fallbackName: string | null | undefined }) {
  if (teamId) return <TeamLabel teamMap={teamMap} teamId={teamId} />;
  return fallbackName || "TBD";
}

function CompactTeamLabel({ teamMap, teamId }: { teamMap: Map<string, Team>; teamId: string | null | undefined }) {
  if (!teamId) return <Box component="span">TBD</Box>;
  const team = teamMap.get(teamId);
  if (!team) return <Box component="span">{teamId}</Box>;

  return (
    <Stack component="span" direction="row" spacing={0.3} alignItems="center" sx={{ minWidth: 0 }}>
      <Box component="span" aria-hidden="true" title={`${team.abbr} flag`} sx={{ fontSize: "0.8rem", lineHeight: 1 }}>
        {flagForTeam(team)}
      </Box>
      <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 900, letterSpacing: 0, lineHeight: 1 }}>
        {team.abbr}
      </Box>
    </Stack>
  );
}

function CompactMatchTeamLabel({ teamMap, teamId, fallbackName }: { teamMap: Map<string, Team>; teamId: string | null | undefined; fallbackName: string | null | undefined }) {
  if (teamId) return <CompactTeamLabel teamMap={teamMap} teamId={teamId} />;
  return (
    <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 900, lineHeight: 1, maxWidth: 92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={fallbackName ?? "TBD"}>
      {fallbackName ?? "TBD"}
    </Box>
  );
}

function formatUpdatedLabel(value: string | null): string {
  if (!value) return "-";
  const updatedAt = new Date(value);
  const todayKey = easternDateKey(new Date());
  const updatedKey = easternDateKey(updatedAt);

  if (todayKey === updatedKey) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(updatedAt);
  }

  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);
  const [updatedYear, updatedMonth, updatedDay] = updatedKey.split("-").map(Number);
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const updatedUtc = Date.UTC(updatedYear, updatedMonth - 1, updatedDay);
  const daysAgo = Math.max(1, Math.round((todayUtc - updatedUtc) / 86_400_000));
  return `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
}

function formatMatchTime(value: string | null): string {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value));
}

function formatScheduleKickoff(value: string | null): string {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value));
}

function easternDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/New_York" }).format(date);
}

function formatLiveClock(clock: string | null, statusText: string): string {
  if (clock) {
    const minute = clock.match(/^(\d{1,3})(?::\d{2})?$/);
    return minute ? `${minute[1]}'` : clock;
  }
  return statusText || "Live";
}

function scoreText(match: Match): string {
  return `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`;
}

function shouldDisplayAsFinal(match: Match): boolean {
  if (match.status === "post") return true;
  if (match.status === "in" || match.status === "postponed" || match.status === "cancelled" || !match.kickoffAt) return false;

  const kickoffTime = new Date(match.kickoffAt).getTime();
  if (!Number.isFinite(kickoffTime)) return false;

  return Date.now() - kickoffTime >= MATCH_FINAL_DISPLAY_DELAY_MS;
}

function matchStatusChip(match: Match): { color: MatchStatusChipColor; label: string } {
  if (match.status === "in") {
    return { color: "error", label: `LIVE ${formatLiveClock(match.clock, match.statusText)}` };
  }

  if (shouldDisplayAsFinal(match)) {
    return { color: "success", label: "FT" };
  }

  if (match.status === "postponed" || match.status === "cancelled") {
    return { color: "warning", label: match.statusText || match.status };
  }

  return { color: "default", label: match.status === "pre" ? formatMatchTime(match.kickoffAt) : match.statusText || match.status };
}

function TodayMatches({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const todayKey = easternDateKey(new Date());
  const todaysMatches = state.matches
    .filter((match) => match.kickoffAt && easternDateKey(match.kickoffAt) === todayKey)
    .sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""));

  if (todaysMatches.length === 0) {
    return (
      <Chip
        size="small"
        variant="outlined"
        label={state.sources.matches.message ?? "No matches today"}
        color={state.sources.matches.stale ? "warning" : "default"}
        sx={{ maxWidth: "100%" }}
      />
    );
  }

  return (
    <Box
      aria-label="Today's matches"
      sx={{
        display: "flex",
        flex: "1 1 auto",
        gap: 0.75,
        minWidth: 0,
        maxWidth: "100%",
        overflowX: "auto",
        pb: 0.1,
        scrollbarWidth: "thin",
      }}
    >
      {todaysMatches.map((match) => {
        const isLive = match.status === "in";
        const statusChip = matchStatusChip(match);
        return (
          <Paper
            key={match.id}
            variant="outlined"
            sx={{
              alignItems: "center",
              bgcolor: isLive ? "success.light" : "background.paper",
              borderColor: isLive ? "success.main" : "divider",
              color: isLive ? "success.contrastText" : "text.primary",
              display: "flex",
              flex: "0 0 auto",
              gap: 0.4,
              minHeight: 24,
              px: 0.75,
              py: 0.25,
            }}
          >
            <Chip size="small" label={match.group ?? match.round} sx={{ height: 17, fontSize: "0.62rem", fontWeight: 900, px: 0 }} />
            <CompactMatchTeamLabel teamMap={teamMap} teamId={match.homeTeamId} fallbackName={match.homeTeamName} />
            <Typography variant="body2" fontWeight={900} sx={{ fontSize: "0.7rem", lineHeight: 1, minWidth: 28, textAlign: "center", whiteSpace: "nowrap" }}>
              {scoreText(match)}
            </Typography>
            <CompactMatchTeamLabel teamMap={teamMap} teamId={match.awayTeamId} fallbackName={match.awayTeamName} />
            <Chip
              size="small"
              color={statusChip.color}
              label={statusChip.label}
              sx={{
                animation: isLive ? "liveBadgePulse 3.2s ease-in-out infinite" : "none",
                fontSize: "0.62rem",
                fontWeight: 900,
                height: 17,
                "@keyframes liveBadgePulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.42 },
                },
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                },
              }}
            />
          </Paper>
        );
      })}
    </Box>
  );
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ height: "100%" }}>
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "primary.main",
              borderRadius: 2.5,
              color: "primary.contrastText",
              display: "flex",
              flex: "0 0 auto",
              height: 44,
              justifyContent: "center",
              width: 44,
              "& svg": { color: "inherit" },
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h2">{value}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25 }}>
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function PickSelector({ members, selectedMemberId, onChange }: { members: AppState["members"]; selectedMemberId: string; onChange: (memberId: string) => void }) {
  return (
    <FormControl size="small" sx={{ minWidth: { sm: 240 }, width: { xs: "100%", sm: 280 } }}>
      <InputLabel id="member-select-label">Member</InputLabel>
      <Select labelId="member-select-label" label="Member" value={selectedMemberId} onChange={(event) => onChange(event.target.value)}>
        {members.map((member) => (
          <MenuItem key={member.id} value={member.id}>
            {member.displayName}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function Bars({ rows, teamMap, maxRows = 10 }: { rows: Array<[string, number]>; teamMap: Map<string, Team>; maxRows?: number }) {
  const topRows = rows.slice(0, maxRows);
  const max = Math.max(1, ...topRows.map(([, count]) => count));
  return (
    <Stack spacing={1.25}>
      {topRows.map(([teamId, count]) => (
        <Box key={teamId}>
          <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
            <Typography variant="body2" fontWeight={700}>
              <TeamLabel teamMap={teamMap} teamId={teamId} />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {count}
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={(count / max) * 100} sx={{ height: 8, borderRadius: 1, mt: 0.5 }} />
        </Box>
      ))}
    </Stack>
  );
}

function GroupConsensusList({ rows }: { rows: Array<{ group: GroupId; label: ReactNode; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Stack spacing={1.25}>
      {rows.map((row) => (
        <Box key={row.group}>
          <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Chip size="small" label={row.group} sx={{ fontWeight: 900 }} />
              <Typography variant="body2" fontWeight={700}>
                {row.label}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {row.count}
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={(row.count / max) * 100} sx={{ height: 8, borderRadius: 1, mt: 0.5 }} />
        </Box>
      ))}
    </Stack>
  );
}

function Overview({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const championCounts = countBy(state.picks, (pick) => pick.championPick);
  const topGroupPicks = GROUP_IDS.map((group) => {
    const top = countBy(state.picks, (pick) => pick.groups[group][0]?.teamId)[0];
    return {
      group,
      label: <TeamLabel teamMap={teamMap} teamId={top?.[0]} />,
      count: top?.[1] ?? 0,
    };
  });
  const topThirdPlaceGroups = countBy(
    state.picks.flatMap((pick) => {
      const teamGroups = groupByTeamId(pick);
      return pick.thirdPlaceAdvancers.map((teamId) => teamGroups.get(teamId));
    }),
    (group) => group,
  ).map(([group, count]) => ({ group: group as GroupId, label: `Group ${group}`, count }));

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <StatCard icon={<GroupsIcon color="primary" />} label="Players" value={state.league.playerCount} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <StatCard icon={<SportsSoccerIcon color="primary" />} label="Teams" value={state.league.teamCount} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <StatCard icon={<EmojiEventsIcon color="primary" />} label="Champion Picks" value={championCounts.length} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <StatCard icon={<QueryStatsIcon color="primary" />} label="Live Matches" value={state.matches.length} />
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        <Box sx={{ display: "flex", minWidth: 0 }}>
          <Card sx={{ width: "100%" }}>
            <CardContent>
              <Typography variant="h3" sx={{ mb: 2 }}>
                Champion Picks
              </Typography>
              <Bars rows={championCounts} teamMap={teamMap} />
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ display: "flex", minWidth: 0 }}>
          <Card sx={{ width: "100%" }}>
            <CardContent>
              <Typography variant="h3" sx={{ mb: 2 }}>
                Top Group Picks
              </Typography>
              <GroupConsensusList rows={topGroupPicks} />
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ display: "flex", minWidth: 0 }}>
          <Card sx={{ width: "100%" }}>
            <CardContent>
              <Typography variant="h3" sx={{ mb: 2 }}>
                Top Third-Place Groups
              </Typography>
              <GroupConsensusList rows={topThirdPlaceGroups} />
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Stack>
  );
}

function Participants({ state, teamMap, onViewBracket }: { state: AppState; teamMap: Map<string, Team>; onViewBracket: (memberId: string) => void }) {
  const picksByMember = new Map(state.picks.map((pick) => [pick.memberId, pick]));
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow>
            <TableCell>Member</TableCell>
            <TableCell>Champion</TableCell>
            <TableCell>Bracket</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {state.members.map((member) => {
            const pick = picksByMember.get(member.id);
            return (
              <TableRow key={member.id}>
                <TableCell>{member.displayName}</TableCell>
                <TableCell>
                  <TeamLabel teamMap={teamMap} teamId={pick?.championPick} />
                </TableCell>
                <TableCell>
                  <Chip label="View" size="small" clickable onClick={() => onViewBracket(member.id)} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function GroupsView({ state, pick, teamMap }: { state: AppState; pick: Pick; teamMap: Map<string, Team> }) {
  const thirdPlaceAdvancers = new Set(pick.thirdPlaceAdvancers);
  return (
    <Grid container spacing={{ xs: 1.5, md: 2 }} alignItems="stretch">
      {GROUP_IDS.map((group) => {
        const winnerCounts = countBy(state.picks, (item) => item.groups[group][0]?.teamId);
        const winnerCountMap = new Map(winnerCounts);
        return (
          <Grid key={group} item xs={12} sm={6} lg={3} sx={{ display: "flex" }}>
            <Card sx={{ width: "100%" }}>
              <CardContent>
                <Typography variant="h3" sx={{ mb: 1.5 }}>
                  Group {group}
                </Typography>
                <Stack spacing={0.5}>
                  {pick.groups[group].map((groupPick) => (
                    <Stack
                      key={groupPick.position}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ borderRadius: 2, minHeight: 42, px: 0.75, py: 0.5, "&:nth-of-type(odd)": { bgcolor: "grey.50" } }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Chip size="small" label={groupPick.position} color={groupPick.position <= 2 ? "primary" : "default"} sx={{ minWidth: 28 }} />
                        <Typography component="div">
                          <TeamLabel teamMap={teamMap} teamId={groupPick.teamId} />
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: "0 0 auto", justifyContent: "flex-end" }}>
                        {thirdPlaceAdvancers.has(groupPick.teamId) ? <Chip size="small" variant="outlined" color="secondary" label="Top 3rd Pick" /> : null}
                        {groupPick.position === 1 ? (
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                            Picked by {winnerCountMap.get(groupPick.teamId) ?? 0}/{state.members.length}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

function bracketRowStart(roundDepth: number, matchIndex: number): number {
  return matchIndex * 2 ** roundDepth + 1;
}

function bracketRowSpan(roundDepth: number): number {
  return 2 ** roundDepth;
}

function BracketTeamRow({ teamMap, teamId, winnerId }: { teamMap: Map<string, Team>; teamId: string; winnerId: string }) {
  const isWinner = teamId === winnerId;
  return (
    <Box
      sx={{
        alignItems: "center",
        bgcolor: isWinner ? "success.light" : "transparent",
        border: "1px solid",
        borderColor: isWinner ? "success.main" : "divider",
        borderRadius: 1,
        color: isWinner ? "success.contrastText" : "text.primary",
        display: "flex",
        justifyContent: "space-between",
        minHeight: 22,
        px: 0.6,
        "& .MuiBox-root": {
          color: "inherit",
        },
      }}
    >
      <TeamLabel teamMap={teamMap} teamId={teamId} />
    </Box>
  );
}

function BracketMatchCard({ match, teamMap }: { match: KnockoutPick; teamMap: Map<string, Team> }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        bgcolor: "background.paper",
        p: 0.5,
        position: "relative",
        width: BRACKET_CARD_WIDTH,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.62rem", fontWeight: 800, lineHeight: 1, mb: 0.4 }}>
        Match {match.bracketId}
      </Typography>
      <Stack spacing={0.5}>
        <BracketTeamRow teamMap={teamMap} teamId={match.team1Id} winnerId={match.winnerId} />
        <BracketTeamRow teamMap={teamMap} teamId={match.team2Id} winnerId={match.winnerId} />
      </Stack>
    </Paper>
  );
}

type BracketSideRound = {
  depth: number;
  matches: KnockoutPick[];
  round: Exclude<RoundId, "F">;
};

function BracketSideGrid({ rounds, teamMap }: { rounds: BracketSideRound[]; teamMap: Map<string, Team> }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: `repeat(${rounds.length}, minmax(${BRACKET_CARD_WIDTH}px, 1fr))`,
        gridTemplateRows: `repeat(${BRACKET_SIDE_ROWS}, ${BRACKET_ROW_HEIGHT}px)`,
        justifyItems: "center",
        minWidth: BRACKET_SIDE_MIN_WIDTH,
        position: "relative",
        width: "100%",
      }}
    >
      {rounds.map(({ depth, matches, round }, roundIndex) => {
        return (
          <Box key={round} sx={{ display: "contents" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontSize: "0.65rem",
                fontWeight: 900,
                alignSelf: "start",
                gridColumn: roundIndex + 1,
                gridRow: "1",
                justifySelf: "center",
                letterSpacing: 0,
                textAlign: "center",
                textTransform: "uppercase",
                transform: "translateY(-22px)",
                whiteSpace: "nowrap",
              }}
            >
              {BRACKET_ROUND_LABELS[round]}
            </Typography>
            {matches.map((match, matchIndex) => {
              const rowStart = bracketRowStart(depth, matchIndex);
              const rowSpan = bracketRowSpan(depth);
              return (
                <Box key={match.slotId} sx={{ alignSelf: "center", gridColumn: roundIndex + 1, gridRow: `${rowStart} / span ${rowSpan}`, justifySelf: "center", position: "relative" }}>
                  <BracketMatchCard match={match} teamMap={teamMap} />
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}

function scheduleSections(matches: Match[], filter: ScheduleFilter): Array<{ title: string; matches: Match[] }> {
  const todayKey = easternDateKey(new Date());
  const sorted = [...matches].sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""));
  const isDisrupted = (match: Match) => match.status === "postponed" || match.status === "cancelled";
  const current = sorted.filter((match) => match.status === "in");
  const today = sorted.filter((match) => match.status !== "in" && !isDisrupted(match) && !shouldDisplayAsFinal(match) && match.kickoffAt && easternDateKey(match.kickoffAt) === todayKey);
  const upcoming = sorted.filter((match) => match.status !== "in" && !isDisrupted(match) && !shouldDisplayAsFinal(match) && (!match.kickoffAt || easternDateKey(match.kickoffAt) !== todayKey));
  const past = sorted.filter((match) => shouldDisplayAsFinal(match)).reverse();
  const disrupted = sorted.filter(isDisrupted);

  const sections = [
    { title: "Current", matches: current },
    { title: "Today", matches: today },
    { title: "Upcoming", matches: upcoming },
    { title: "Past", matches: past },
    { title: "Postponed / Cancelled", matches: disrupted },
  ];

  const visibleSectionTitles: Record<ScheduleFilter, Set<string>> = {
    today: new Set(["Current", "Today"]),
    upcoming: new Set(["Upcoming"]),
    past: new Set(["Past"]),
    all: new Set(sections.map((section) => section.title)),
  };

  return sections.filter((section) => section.matches.length > 0 && visibleSectionTitles[filter].has(section.title));
}

function ScheduleTable({ title, matches, teamMap }: { title: string; matches: Match[]; teamMap: Map<string, Team> }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h3" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 1060, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 230 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 340 }} />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell>Kickoff</TableCell>
                <TableCell align="center">Group</TableCell>
                <TableCell align="center">Match</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell>Venue</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matches.map((match) => {
                const statusChip = matchStatusChip(match);
                return (
                  <TableRow key={match.id}>
                    <TableCell>{formatScheduleKickoff(match.kickoffAt)}</TableCell>
                    <TableCell align="center">{match.group ? `Group ${match.group}` : match.round}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" flexWrap="wrap">
                        <MatchTeamLabel teamMap={teamMap} teamId={match.homeTeamId} fallbackName={match.homeTeamName} />
                        <Box component="span" sx={{ color: "text.secondary" }}>
                          vs
                        </Box>
                        <MatchTeamLabel teamMap={teamMap} teamId={match.awayTeamId} fallbackName={match.awayTeamName} />
                    </Stack>
                  </TableCell>
                    <TableCell align="center">
                      <Chip size="small" color={statusChip.color} label={statusChip.label} sx={statusChip.label === "FT" ? undefined : { minWidth: 104 }} />
                    </TableCell>
                    <TableCell align="center">{match.status === "pre" ? "-" : scoreText(match)}</TableCell>
                    <TableCell>{[match.venue.name, match.venue.city].filter(Boolean).join(", ") || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

function KnockoutView({ pick, teamMap }: { pick: Pick; teamMap: Map<string, Team> }) {
  const leftRounds: BracketSideRound[] = [
    { depth: 0, matches: pick.knockout.R32.slice(0, 8), round: "R32" },
    { depth: 1, matches: pick.knockout.R16.slice(0, 4), round: "R16" },
    { depth: 2, matches: pick.knockout.QF.slice(0, 2), round: "QF" },
    { depth: 3, matches: pick.knockout.SF.slice(0, 1), round: "SF" },
  ];
  const rightRounds: BracketSideRound[] = [
    { depth: 3, matches: pick.knockout.SF.slice(1, 2), round: "SF" },
    { depth: 2, matches: pick.knockout.QF.slice(2, 4), round: "QF" },
    { depth: 1, matches: pick.knockout.R16.slice(4, 8), round: "R16" },
    { depth: 0, matches: pick.knockout.R32.slice(8, 16), round: "R32" },
  ];
  const final = pick.knockout.F[0];

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={0.5}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        sx={{ bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider", px: { xs: 2, sm: 2.5 }, py: 1.5 }}
      >
        <Typography variant="h3">Tournament bracket</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          Scroll horizontally to inspect the full bracket
        </Typography>
      </Stack>
      <Box sx={{ overflowX: "auto", px: { xs: 1.5, sm: 2.5 }, pb: 2.5, pt: 4.5, scrollbarWidth: "thin" }}>
        <Box
          sx={{
            alignItems: "stretch",
            display: "grid",
            gap: 1,
            gridTemplateColumns: `minmax(${BRACKET_SIDE_MIN_WIDTH}px, 1fr) ${BRACKET_FINAL_LANE_WIDTH}px minmax(${BRACKET_SIDE_MIN_WIDTH}px, 1fr)`,
            minWidth: BRACKET_SIDE_MIN_WIDTH * 2 + BRACKET_FINAL_LANE_WIDTH + BRACKET_COLUMN_GAP * 2,
            width: "100%",
          }}
        >
          <BracketSideGrid rounds={leftRounds} teamMap={teamMap} />
          <Box
            sx={{
              alignItems: "center",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gridTemplateRows: `repeat(${BRACKET_SIDE_ROWS}, ${BRACKET_ROW_HEIGHT}px)`,
              justifyItems: "center",
              width: "100%",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontSize: "0.65rem",
                fontWeight: 900,
                alignSelf: "start",
                gridColumn: "1",
                gridRow: "1",
                justifySelf: "center",
                letterSpacing: 0,
                textAlign: "center",
                textTransform: "uppercase",
                transform: "translateY(-22px)",
                whiteSpace: "nowrap",
              }}
            >
              {BRACKET_ROUND_LABELS.F}
            </Typography>
            {final ? (
              <Box sx={{ alignSelf: "center", gridColumn: "1", gridRow: `1 / span ${BRACKET_SIDE_ROWS}`, justifySelf: "center" }}>
                <BracketMatchCard match={final} teamMap={teamMap} />
              </Box>
            ) : null}
          </Box>
          <BracketSideGrid rounds={rightRounds} teamMap={teamMap} />
        </Box>
      </Box>
    </Paper>
  );
}

function ScheduleView({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const [filter, setFilter] = useState<ScheduleFilter>("all");
  const sections = scheduleSections(state.matches, filter);
  const showEmptyFilterMessage = state.matches.length > 0 && sections.length === 0;

  if (state.matches.length === 0) {
    return <Alert severity="info">{state.sources.matches.message ?? "No match schedule data loaded yet."}</Alert>;
  }

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          pb: 1.5,
        }}
      >
        <Typography variant="h3" sx={{ alignSelf: { sm: "center" } }}>
          Matches
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, value: ScheduleFilter | null) => {
            if (value) setFilter(value);
          }}
          aria-label="Schedule match filter"
          sx={{
            display: "grid",
            gap: 0.5,
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            width: { xs: "100%", sm: "auto" },
            "& .MuiToggleButtonGroup-grouped": {
              border: 0,
              borderRadius: 1,
              color: "text.secondary",
              fontWeight: 800,
              minHeight: 34,
              px: { xs: 1, sm: 1.5 },
              textTransform: "none",
              whiteSpace: "nowrap",
              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "primary.contrastText",
              },
              "&.Mui-selected:hover": {
                bgcolor: "primary.dark",
              },
            },
          }}
        >
          {SCHEDULE_FILTERS.map((option) => (
            <ToggleButton key={option.value} value={option.value} aria-label={`Show ${option.label.toLowerCase()} matches`}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      {showEmptyFilterMessage ? <Alert severity="info">No {filter} matches to show.</Alert> : null}
      {sections.map((section) => (
        <ScheduleTable key={section.title} title={section.title} matches={section.matches} teamMap={teamMap} />
      ))}
    </Stack>
  );
}

function Compare({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const [memberA, setMemberA] = useState(state.members[0]?.id ?? "");
  const [memberB, setMemberB] = useState(state.members[1]?.id ?? state.members[0]?.id ?? "");
  const pickA = state.picks.find((pick) => pick.memberId === memberA);
  const pickB = state.picks.find((pick) => pick.memberId === memberB);
  if (!pickA || !pickB) return null;

  const rows: Array<{ label: string; a: string; b: string; match: boolean }> = [
    { label: "Champion", a: teamLabelText(teamMap, pickA.championPick), b: teamLabelText(teamMap, pickB.championPick), match: pickA.championPick === pickB.championPick },
    { label: "Finalists", a: teamListText(teamMap, finalistIds(pickA)), b: teamListText(teamMap, finalistIds(pickB)), match: sameSet(finalistIds(pickA), finalistIds(pickB)) },
    { label: "Semifinalists", a: teamListText(teamMap, roundTeamIds(pickA, "SF")), b: teamListText(teamMap, roundTeamIds(pickB, "SF")), match: sameSet(roundTeamIds(pickA, "SF"), roundTeamIds(pickB, "SF")) },
    { label: "Quarterfinalists", a: teamListText(teamMap, roundTeamIds(pickA, "QF")), b: teamListText(teamMap, roundTeamIds(pickB, "QF")), match: sameSet(roundTeamIds(pickA, "QF"), roundTeamIds(pickB, "QF")) },
    {
      label: "Third-place advancers",
      a: teamListText(teamMap, pickA.thirdPlaceAdvancers),
      b: teamListText(teamMap, pickB.thirdPlaceAdvancers),
      match: sameSet(pickA.thirdPlaceAdvancers, pickB.thirdPlaceAdvancers),
    },
    ...GROUP_IDS.map((group) => {
      const a = pickA.groups[group][0]?.teamId;
      const b = pickB.groups[group][0]?.teamId;
      return { label: `Group ${group} winner`, a: teamLabelText(teamMap, a), b: teamLabelText(teamMap, b), match: a === b };
    }),
    ...ROUND_IDS.flatMap((round) =>
      pickA.knockout[round].map((match, index) => {
        const other = pickB.knockout[round][index];
        return {
          label: `${round} match ${index + 1}`,
          a: teamLabelText(teamMap, match.winnerId),
          b: teamLabelText(teamMap, other?.winnerId),
          match: match.winnerId === other?.winnerId,
        };
      }),
    ),
  ];
  const matches = rows.filter((row) => row.match).length;

  return (
    <Stack spacing={2}>
      <Paper
        variant="outlined"
        sx={{
          alignItems: { sm: "center" },
          bgcolor: "grey.50",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.5,
          p: { xs: 2, sm: 2.5 },
        }}
      >
        <PickSelector members={state.members} selectedMemberId={memberA} onChange={setMemberA} />
        <CompareArrowsIcon color="action" sx={{ alignSelf: "center", transform: { xs: "rotate(90deg)", sm: "none" } }} />
        <PickSelector members={state.members} selectedMemberId={memberB} onChange={setMemberB} />
        <Chip label={`${matches} of ${rows.length} picks match`} color="primary" sx={{ ml: { sm: "auto" } }} />
      </Paper>
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              <TableCell>Pick</TableCell>
              <TableCell>Player A</TableCell>
              <TableCell>Player B</TableCell>
              <TableCell>Match</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.a}</TableCell>
                <TableCell>{row.b}</TableCell>
                <TableCell>
                  <Chip size="small" label={row.match ? "Yes" : "No"} color={row.match ? "success" : "default"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function Leaderboard({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            <TableCell>Rank</TableCell>
            <TableCell>Member</TableCell>
            <TableCell>Total</TableCell>
            <TableCell>Groups</TableCell>
            <TableCell>Third</TableCell>
            <TableCell>Knockout</TableCell>
            <TableCell>Champion Bonus</TableCell>
            <TableCell>Champion Pick</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {state.leaderboard.map((entry) => (
            <TableRow key={entry.memberId}>
              <TableCell sx={{ fontWeight: 900 }}>{entry.rank}</TableCell>
              <TableCell>{entry.displayName}</TableCell>
              <TableCell sx={{ color: "primary.main", fontWeight: 900 }}>{entry.totalPoints}</TableCell>
              <TableCell>{entry.groupPoints}</TableCell>
              <TableCell>{entry.thirdPlacePoints}</TableCell>
              <TableCell>{entry.knockoutPoints}</TableCell>
              <TableCell>{entry.championBonus}</TableCell>
              <TableCell>
                <TeamLabel teamMap={teamMap} teamId={entry.championPick} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function Dashboard({ initialData }: { initialData: StaticAppData }) {
  const [tab, setTab] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState(initialData.members[0]?.id ?? "");
  const canonicalTeamIds = useMemo(() => new Set(initialData.teams.map((team) => team.id)), [initialData.teams]);
  const live = useEspnLiveMatches(canonicalTeamIds);
  const tournamentResults = useMemo(
    () => (tab === 6 ? buildTournamentResults(initialData, live.matches) : null),
    [initialData, live.matches, tab],
  );
  const state = useMemo<AppState>(() => ({
    ...initialData,
    capturedAt: live.capturedAt ?? new Date(0).toISOString(),
    sources: {
      ...initialData.sources,
      matches: {
        provider: "espn",
        capturedAt: live.capturedAt,
        lastSuccessfulFetchAt: live.lastSuccessfulFetchAt,
        stale: live.stale,
        message: live.message,
      },
    },
    matches: live.matches,
    groups: tournamentResults?.groups ?? emptyGroups(),
    actualBracket: tournamentResults?.actualBracket ?? emptyActualBracket(),
    leaderboard: tournamentResults?.leaderboard ?? [],
  }), [initialData, live, tournamentResults]);
  const teamMap = useMemo(() => new Map(state.teams.map((team) => [team.id, team])), [state.teams]);
  const selectedPick = state.picks.find((pick) => pick.memberId === selectedMemberId) ?? state.picks[0];

  return (
    <Box>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Container maxWidth="xl">
          <Toolbar
            disableGutters
            sx={{
              display: "grid",
              gap: { xs: 1.25, md: 2 },
              gridTemplateColumns: { xs: "minmax(0, 1fr) auto", md: "190px minmax(0, 1fr) auto" },
              minHeight: { xs: 0, md: 68 },
              py: { xs: 1.5, md: 1 },
            }}
          >
            <Box sx={{ gridColumn: { md: 1 }, gridRow: { md: 1 }, minWidth: 0 }}>
              <Typography component="h1" variant="h1">
                Famiry 2026
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2, mt: 0.25 }}>
                World Cup bracket challenge
              </Typography>
            </Box>
            <Box sx={{ gridColumn: { xs: "1 / -1", md: 2 }, gridRow: { xs: 2, md: 1 }, minWidth: 0 }}>
              <TodayMatches state={state} teamMap={teamMap} />
            </Box>
            <Chip
              label={`Updated ${formatUpdatedLabel(state.capturedAt)}`}
              color={state.sources.matches.stale ? "warning" : "success"}
              sx={{ gridColumn: { md: 3 }, gridRow: { md: 1 }, justifySelf: "end", whiteSpace: "nowrap" }}
            />
          </Toolbar>
        </Container>
        <Box sx={{ borderTop: { md: "1px solid #d8e0eb" } }}>
          <Container maxWidth="xl">
            <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Dashboard sections">
              {TAB_LABELS.map((label) => (
                <Tab key={label} label={label} />
              ))}
            </Tabs>
          </Container>
        </Box>
      </AppBar>

      <Container maxWidth="xl" component="main" sx={{ py: { xs: 2.5, md: 4 } }}>
        {live.loading ? <LinearProgress sx={{ mb: 2 }} /> : null}
        {state.sources.matches.stale ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {state.sources.matches.message ?? "Live match data is stale or unavailable. Picks remain available."}
          </Alert>
        ) : null}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "flex-end" }}
          justifyContent="space-between"
          sx={{ mb: { xs: 2, md: 3 } }}
        >
          <Box>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 900, letterSpacing: "0.12em", lineHeight: 1.4 }}>
              Bracket dashboard
            </Typography>
            <Typography component="h2" variant="h2">
              {TAB_LABELS[tab]}
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              {TAB_DESCRIPTIONS[tab]}
            </Typography>
          </Box>
          {[2, 3].includes(tab) && selectedPick ? (
            <PickSelector members={state.members} selectedMemberId={selectedPick.memberId} onChange={setSelectedMemberId} />
          ) : null}
        </Stack>

        {tab === 0 ? <Overview state={state} teamMap={teamMap} /> : null}
        {tab === 1 ? <Participants state={state} teamMap={teamMap} onViewBracket={(memberId) => { setSelectedMemberId(memberId); setTab(3); }} /> : null}
        {tab === 2 && selectedPick ? <GroupsView state={state} pick={selectedPick} teamMap={teamMap} /> : null}
        {tab === 3 && selectedPick ? <KnockoutView pick={selectedPick} teamMap={teamMap} /> : null}
        {tab === 4 ? <ScheduleView state={state} teamMap={teamMap} /> : null}
        {tab === 5 ? <Compare state={state} teamMap={teamMap} /> : null}
        {tab === 6 ? <Leaderboard state={state} teamMap={teamMap} /> : null}
      </Container>
    </Box>
  );
}
