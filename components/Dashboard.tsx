"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  AppBar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  IconButton,
  LinearProgress,
  Paper,
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
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useEspnLiveMatches } from "@/hooks/useEspnLiveMatches";
import { buildTournamentResults, emptyActualBracket, emptyGroups } from "@/lib/app-data/deriveTournamentResults";
import { selectMobileHeaderMatch } from "@/lib/app-data/headerMatches";
import { flagForTeam, formatTeamLabel } from "@/lib/app-data/teamDisplay";
import {
  DASHBOARD_TAB_LABELS,
  LAST_DASHBOARD_TAB_COOKIE_KEY,
  LAST_DASHBOARD_TAB_STORAGE_KEY,
  dashboardTabIndex,
} from "@/lib/dashboardPreferences";
import type { AppState, GroupId, Match, RoundId, StaticAppData, Team } from "@/lib/schemas/appData";
import { GROUP_IDS, ROUND_IDS } from "@/lib/schemas/appData";

type MatchStatusChipColor = "default" | "error" | "success" | "warning";
type ScheduleFilter = "today" | "upcoming" | "past" | "all";

const TAB_DESCRIPTIONS = [
  "Current points and scoring breakdown",
  "Compare every player's group-stage predictions",
  "Compare every player's knockout predictions",
  "Live, upcoming, and completed tournament matches",
] as const;
const BRACKET_ROUND_LABELS: Record<RoundId, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  F: "Final",
};
const MATCH_FINAL_DISPLAY_DELAY_MS = 2.5 * 60 * 60 * 1000;
const SCHEDULE_FILTERS: Array<{ label: string; value: ScheduleFilter }> = [
  { label: "All", value: "all" },
  { label: "Today", value: "today" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
];

function teamLabelText(teamMap: Map<string, Team>, teamId: string | null | undefined): string {
  if (!teamId) return "-";
  const team = teamMap.get(teamId);
  return team ? formatTeamLabel(team) : teamId;
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

function ScheduleKickoff({ value }: { value: string | null }) {
  if (!value) return "TBD";
  const kickoff = new Date(value);
  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "America/New_York" }).format(kickoff);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(kickoff);

  return (
    <>
      <Box component="span" sx={{ display: { xs: "block", sm: "none" }, fontSize: "0.75rem", lineHeight: 1.3 }}>
        <Box component="span" sx={{ display: "block", whiteSpace: "nowrap" }}>{date}</Box>
        <Box component="span" sx={{ display: "block", whiteSpace: "nowrap" }}>{time} ET</Box>
      </Box>
      <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{formatScheduleKickoff(value)}</Box>
    </>
  );
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
  const mobileMatch = selectMobileHeaderMatch(todaysMatches);

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
        justifyContent: { xs: "center", sm: "flex-start" },
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
            data-testid="header-match-card"
            variant="outlined"
            sx={{
              alignItems: "center",
              bgcolor: isLive ? "success.light" : "background.paper",
              borderColor: isLive ? "success.main" : "divider",
              color: isLive ? "success.contrastText" : "text.primary",
              display: { xs: match.id === mobileMatch?.id ? "flex" : "none", sm: "flex" },
              flex: "0 0 auto",
              gap: 0.4,
              minHeight: 24,
              minWidth: 250,
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
              data-testid="header-match-status"
              size="small"
              color={statusChip.color}
              label={statusChip.label}
              sx={{
                animation: isLive ? "liveBadgePulse 3.2s ease-in-out infinite" : "none",
                fontSize: "0.62rem",
                fontWeight: 900,
                height: 17,
                ml: "auto",
                minWidth: 72,
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

function MobileScrollHint({ children }: { children: ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" }, fontWeight: 700 }}>
      {children}
    </Typography>
  );
}

const COMPARISON_PLAYER_COLUMN_WIDTH = { xs: 87, sm: 150 } as const;
const COMPARISON_PICK_COLUMN_WIDTH = 76;
const COMPARISON_BODY_ROW_HEIGHT = 34;
const comparisonStickyPlayerCellSx = {
  bgcolor: "background.paper",
  borderRight: "1px solid",
  borderRightColor: "divider",
  left: 0,
  maxWidth: COMPARISON_PLAYER_COLUMN_WIDTH,
  minWidth: COMPARISON_PLAYER_COLUMN_WIDTH,
  overflow: "hidden",
  position: "sticky",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: COMPARISON_PLAYER_COLUMN_WIDTH,
  zIndex: 2,
} as const;
const comparisonTableSx = {
  "& .MuiTableCell-root": {
    fontSize: { xs: "0.7rem", sm: "0.78rem" },
    lineHeight: 1.25,
    px: 0.75,
    py: 0.5,
  },
} as const;

function GroupsView({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const [selectedGroups, setSelectedGroups] = useState<GroupId[]>([...GROUP_IDS]);
  const picksByMember = new Map(state.picks.map((pick) => [pick.memberId, pick]));

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
        <Typography variant="h3" sx={{ alignSelf: { sm: "center" }, display: { xs: "none", sm: "block" } }}>
          Group Filter
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={selectedGroups.length === GROUP_IDS.length ? ["ALL"] : selectedGroups}
          onChange={(_, values: string[]) => {
            const currentlyAll = selectedGroups.length === GROUP_IDS.length;
            const requestedGroups = GROUP_IDS.filter((group) => values.includes(group));
            if (values.includes("ALL") && !currentlyAll) {
              setSelectedGroups([...GROUP_IDS]);
            } else if (currentlyAll && requestedGroups.length > 0) {
              setSelectedGroups(requestedGroups);
            } else if (requestedGroups.length > 0) {
              setSelectedGroups(requestedGroups);
            } else {
              setSelectedGroups([...GROUP_IDS]);
            }
          }}
          aria-label="Group filter"
          sx={{
            display: { xs: "flex", sm: "grid" },
            flexWrap: { xs: "wrap", sm: "nowrap" },
            gap: 0.5,
            gridTemplateColumns: { sm: "repeat(7, 36px)" },
            justifyContent: { xs: "start", sm: "end" },
            width: { xs: "100%", sm: "auto" },
            "& .MuiToggleButtonGroup-grouped": {
              border: 0,
              borderRadius: 1,
              color: "text.secondary",
              flex: { xs: "1 1 calc((100% - 24px) / 7)", sm: "0 0 auto" },
              fontSize: "0.7rem",
              fontWeight: 800,
              minHeight: 26,
              minWidth: 0,
              px: 0.5,
              py: 0.25,
              textTransform: "none",
              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "primary.contrastText",
              },
              "&.Mui-selected:hover": {
                bgcolor: "primary.dark",
              },
            },
            "@media (min-width: 900px)": {
              gridTemplateColumns: "repeat(13, 36px)",
            },
          }}
        >
          <ToggleButton value="ALL" aria-label="Show all groups">All</ToggleButton>
          {GROUP_IDS.map((group) => (
            <ToggleButton key={group} value={group} aria-label={`Show Group ${group}`}>{group}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <MobileScrollHint>Scroll horizontally to compare all group picks</MobileScrollHint>
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%", overflowX: "auto" }}>
        <Table
          size="small"
          sx={{
            ...comparisonTableSx,
            minWidth: {
              xs: COMPARISON_PLAYER_COLUMN_WIDTH.xs + selectedGroups.length * 4 * COMPARISON_PICK_COLUMN_WIDTH,
              sm: COMPARISON_PLAYER_COLUMN_WIDTH.sm + selectedGroups.length * 4 * COMPARISON_PICK_COLUMN_WIDTH,
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2} sx={{ ...comparisonStickyPlayerCellSx, top: 0, zIndex: 4, fontWeight: 900 }}>
                Participant
              </TableCell>
              {selectedGroups.map((group) => (
                <TableCell key={group} align="center" colSpan={4} sx={{ bgcolor: "grey.100", borderLeft: "1px solid", borderLeftColor: "divider", fontWeight: 900 }}>
                  Group {group}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              {selectedGroups.flatMap((group) => [1, 2, 3, 4].map((position) => (
                <TableCell
                  key={`${group}-${position}`}
                  align="center"
                  sx={{ minWidth: COMPARISON_PICK_COLUMN_WIDTH, whiteSpace: "nowrap", ...(position === 1 ? { borderLeft: "1px solid", borderLeftColor: "divider" } : {}) }}
                >
                  Pos {position}
                </TableCell>
              )))}
            </TableRow>
          </TableHead>
          <TableBody>
            {state.members.map((member) => {
              const pick = picksByMember.get(member.id);
              return (
                <TableRow key={member.id} hover sx={{ height: COMPARISON_BODY_ROW_HEIGHT }}>
                  <TableCell component="th" scope="row" title={member.displayName} sx={{ ...comparisonStickyPlayerCellSx, fontWeight: 800 }}>
                    {member.displayName}
                  </TableCell>
                  {selectedGroups.flatMap((group) => [1, 2, 3, 4].map((position) => {
                    const teamId = pick?.groups[group].find((groupPick) => groupPick.position === position)?.teamId;
                    const currentTeamId = state.groups[group].find((standing) => standing.position === position)?.teamId;
                    const isCorrectPosition = Boolean(teamId && teamId === currentTeamId);
                    return (
                      <TableCell key={`${group}-${position}`} sx={{ minWidth: COMPARISON_PICK_COLUMN_WIDTH, ...(position === 1 ? { borderLeft: "1px solid", borderLeftColor: "divider" } : {}) }}>
                        <Box
                          data-correct-position={isCorrectPosition ? "true" : undefined}
                          sx={{
                            border: "1px solid",
                            borderColor: isCorrectPosition ? "success.main" : "transparent",
                            borderRadius: 1,
                            px: 0.5,
                            py: 0.25,
                          }}
                        >
                          <TeamLabel teamMap={teamMap} teamId={teamId} />
                        </Box>
                      </TableCell>
                    );
                  }))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
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
          <Table size="small" sx={{ minWidth: { xs: 0, sm: 1060 }, tableLayout: "fixed" }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ textAlign: { xs: "center", sm: "left" }, width: { xs: "32%", sm: 150 } }}>Kickoff</TableCell>
                <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" }, width: 120 }}>Group</TableCell>
                <TableCell align="center" sx={{ width: { xs: "48%", sm: 230 } }}>Match</TableCell>
                <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" }, width: 110 }}>Status</TableCell>
                <TableCell align="center" sx={{ width: { xs: "20%", sm: 120 } }}>Score</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, width: 340 }}>Venue</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matches.map((match) => {
                const statusChip = matchStatusChip(match);
                return (
                  <TableRow key={match.id}>
                    <TableCell sx={{ px: { xs: 0.75, sm: 2 }, textAlign: { xs: "center", sm: "left" } }}><ScheduleKickoff value={match.kickoffAt} /></TableCell>
                    <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" } }}>{match.group ? `Group ${match.group}` : match.round}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" flexWrap="wrap">
                        <MatchTeamLabel teamMap={teamMap} teamId={match.homeTeamId} fallbackName={match.homeTeamName} />
                        <Box component="span" sx={{ color: "text.secondary" }}>
                          vs
                        </Box>
                        <MatchTeamLabel teamMap={teamMap} teamId={match.awayTeamId} fallbackName={match.awayTeamName} />
                    </Stack>
                  </TableCell>
                    <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      <Chip size="small" color={statusChip.color} label={statusChip.label} sx={statusChip.label === "FT" ? undefined : { minWidth: 104 }} />
                    </TableCell>
                    <TableCell align="center">{match.status === "pre" ? "-" : scoreText(match)}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{[match.venue.name, match.venue.city].filter(Boolean).join(", ") || "-"}</TableCell>
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

function KnockoutView({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const [selectedRounds, setSelectedRounds] = useState<RoundId[]>([...ROUND_IDS]);
  const picksByMember = new Map(state.picks.map((pick) => [pick.memberId, pick]));
  const visibleMatchCount = selectedRounds.reduce(
    (total, round) => total + (state.picks[0]?.knockout[round].length ?? 0),
    0,
  );

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1.5 }}
      >
        <Typography variant="h3" sx={{ alignSelf: { sm: "center" }, display: { xs: "none", sm: "block" } }}>
          Round Filter
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={selectedRounds.length === ROUND_IDS.length ? ["ALL"] : selectedRounds}
          onChange={(_, values: string[]) => {
            const currentlyAll = selectedRounds.length === ROUND_IDS.length;
            const requestedRounds = ROUND_IDS.filter((round) => values.includes(round));
            if (values.includes("ALL") && !currentlyAll) {
              setSelectedRounds([...ROUND_IDS]);
            } else if (currentlyAll && requestedRounds.length > 0) {
              setSelectedRounds(requestedRounds);
            } else if (requestedRounds.length > 0) {
              setSelectedRounds(requestedRounds);
            } else {
              setSelectedRounds([...ROUND_IDS]);
            }
          }}
          aria-label="Round filter"
          sx={{
            display: "grid",
            gap: 0.5,
            gridTemplateColumns: "repeat(6, minmax(44px, auto))",
            justifyContent: { xs: "start", sm: "end" },
            width: { xs: "100%", sm: "auto" },
            "& .MuiToggleButtonGroup-grouped": {
              border: 0,
              borderRadius: 1,
              color: "text.secondary",
              fontSize: "0.7rem",
              fontWeight: 800,
              minHeight: 26,
              minWidth: 0,
              px: 0.75,
              py: 0.25,
              textTransform: "none",
              "&.Mui-selected": { bgcolor: "primary.main", color: "primary.contrastText" },
              "&.Mui-selected:hover": { bgcolor: "primary.dark" },
            },
          }}
        >
          <ToggleButton value="ALL" aria-label="Show all rounds">All</ToggleButton>
          {ROUND_IDS.map((round) => (
            <ToggleButton key={round} value={round} aria-label={`Show ${BRACKET_ROUND_LABELS[round]}`}>
              {round}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <MobileScrollHint>Scroll horizontally to compare all knockout picks</MobileScrollHint>
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%", overflowX: "auto" }}>
        <Table
          size="small"
          sx={{
            ...comparisonTableSx,
            minWidth: {
              xs: COMPARISON_PLAYER_COLUMN_WIDTH.xs + visibleMatchCount * COMPARISON_PICK_COLUMN_WIDTH,
              sm: COMPARISON_PLAYER_COLUMN_WIDTH.sm + visibleMatchCount * COMPARISON_PICK_COLUMN_WIDTH,
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2} sx={{ ...comparisonStickyPlayerCellSx, top: 0, zIndex: 4, fontWeight: 900 }}>
                Participant
              </TableCell>
              {selectedRounds.map((round) => (
                <TableCell
                  key={round}
                  align="center"
                  colSpan={state.picks[0]?.knockout[round].length ?? 0}
                  sx={{ bgcolor: "grey.100", borderLeft: "1px solid", borderLeftColor: "divider", fontWeight: 900 }}
                >
                  {BRACKET_ROUND_LABELS[round]}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              {selectedRounds.flatMap((round) =>
                (state.picks[0]?.knockout[round] ?? []).map((match, index) => (
                  <TableCell
                    key={`${round}-${match.slotId}`}
                    align="center"
                    sx={{ minWidth: COMPARISON_PICK_COLUMN_WIDTH, whiteSpace: "nowrap", ...(index === 0 ? { borderLeft: "1px solid", borderLeftColor: "divider" } : {}) }}
                  >
                    Match {index + 1}
                  </TableCell>
                )),
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {state.members.map((member) => {
              const pick = picksByMember.get(member.id);
              return (
                <TableRow key={member.id} hover sx={{ height: COMPARISON_BODY_ROW_HEIGHT }}>
                  <TableCell component="th" scope="row" title={member.displayName} sx={{ ...comparisonStickyPlayerCellSx, fontWeight: 800 }}>
                    {member.displayName}
                  </TableCell>
                  {selectedRounds.flatMap((round) =>
                    (pick?.knockout[round] ?? []).map((match, index) => (
                      <TableCell
                        key={`${round}-${match.slotId}`}
                        sx={{ minWidth: COMPARISON_PICK_COLUMN_WIDTH, ...(index === 0 ? { borderLeft: "1px solid", borderLeftColor: "divider" } : {}) }}
                      >
                        <TeamLabel teamMap={teamMap} teamId={match.winnerId} />
                      </TableCell>
                    )),
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
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
        <Typography variant="h3" sx={{ alignSelf: { sm: "center" }, display: { xs: "none", sm: "block" } }}>
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
              fontSize: "0.7rem",
              fontWeight: 800,
              minHeight: 26,
              minWidth: 0,
              px: 0.75,
              py: 0.25,
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

function Leaderboard({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const desktopOnlyCellSx = { display: { xs: "none", sm: "table-cell" } } as const;
  const rankCellSx = {
    width: { xs: 58, sm: "5%" },
    maxWidth: { xs: 58, sm: "5%" },
    whiteSpace: "nowrap",
  } as const;
  const participantCellSx = {
    width: { xs: 162, sm: "24%" },
    maxWidth: { xs: 162, sm: "24%" },
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as const;
  const totalCellSx = {
    width: { xs: 68, sm: "13%" },
    maxWidth: { xs: 68, sm: "13%" },
    whiteSpace: "nowrap",
  } as const;

  return (
    <Stack spacing={1}>
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: { xs: "hidden", sm: "auto" } }}>
        <Table
          size="small"
          sx={{
            minWidth: { xs: 0, sm: 720 },
            tableLayout: "fixed",
            width: "100%",
            "& .MuiTableCell-root": { px: { xs: 0.75, sm: 2 } },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={rankCellSx}>Rank</TableCell>
              <TableCell sx={participantCellSx}>Participant</TableCell>
              <TableCell align="center" sx={{ width: { sm: "20%" } }}>Champion</TableCell>
              <TableCell align="center" sx={{ ...desktopOnlyCellSx, width: { sm: "18%" } }}>Group</TableCell>
              <TableCell align="center" sx={{ ...desktopOnlyCellSx, width: { sm: "20%" } }}>Knockout</TableCell>
              <TableCell align="center" sx={totalCellSx}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {state.leaderboard.map((entry) => (
              <TableRow key={entry.memberId}>
                <TableCell align="center" sx={{ ...rankCellSx, fontWeight: 900 }}>{entry.rank}</TableCell>
                <TableCell sx={participantCellSx}>{entry.displayName}</TableCell>
                <TableCell align="center" sx={{ width: { sm: "20%" }, "& > .MuiStack-root": { justifyContent: "center" } }}>
                  <TeamLabel teamMap={teamMap} teamId={entry.championPick} />
                </TableCell>
                <TableCell align="center" sx={{ ...desktopOnlyCellSx, width: { sm: "18%" } }}>{entry.groupPoints}</TableCell>
                <TableCell align="center" sx={{ ...desktopOnlyCellSx, width: { sm: "20%" } }}>{entry.knockoutPoints}</TableCell>
                <TableCell align="center" sx={{ ...totalCellSx, color: "primary.main", fontWeight: 900 }}>{entry.totalPoints}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

export function Dashboard({ initialData, initialTab }: { initialData: StaticAppData; initialTab?: string }) {
  const [tab, setTab] = useState(() => dashboardTabIndex(initialTab));
  const [scoringTooltipOpen, setScoringTooltipOpen] = useState(false);
  const scoringTooltipUsesClick = useMediaQuery("(hover: none), (pointer: coarse)");
  const canonicalTeamIds = useMemo(() => new Set(initialData.teams.map((team) => team.id)), [initialData.teams]);
  const live = useEspnLiveMatches(canonicalTeamIds);
  const tournamentResults = useMemo(
    () => (tab <= 1 ? buildTournamentResults(initialData, live.matches) : null),
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

  useEffect(() => {
    if (initialTab) return;
    try {
      const savedTab = window.localStorage.getItem(LAST_DASHBOARD_TAB_STORAGE_KEY);
      if (savedTab) {
        setTab(dashboardTabIndex(savedTab));
        document.cookie = `${LAST_DASHBOARD_TAB_COOKIE_KEY}=${encodeURIComponent(savedTab)}; Path=/; Max-Age=31536000; SameSite=Lax`;
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, [initialTab]);

  const selectTab = (nextTab: number) => {
    setScoringTooltipOpen(false);
    setTab(nextTab);
    try {
      const selectedTab = DASHBOARD_TAB_LABELS[nextTab];
      window.localStorage.setItem(LAST_DASHBOARD_TAB_STORAGE_KEY, selectedTab);
      document.cookie = `${LAST_DASHBOARD_TAB_COOKIE_KEY}=${encodeURIComponent(selectedTab)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      // The tab still works when browser storage is unavailable.
    }
  };

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
            <Box sx={{ gridColumn: { xs: "1 / -1", sm: 1, md: 1 }, gridRow: { md: 1 }, minWidth: 0, textAlign: { xs: "center", sm: "left" } }}>
              <Typography component="h1" variant="h1">
                Famiry 2026
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2, mt: 0.25 }}>
                World Cup bracket challenge
              </Typography>
            </Box>
            <Box sx={{ gridColumn: { xs: "1 / -1", md: 2 }, gridRow: { xs: 2, md: 1 }, minWidth: 0, textAlign: { xs: "center", sm: "left" } }}>
              <TodayMatches state={state} teamMap={teamMap} />
            </Box>
            <Chip
              label={`Updated ${formatUpdatedLabel(state.capturedAt)}`}
              color={state.sources.matches.stale ? "warning" : "success"}
              sx={{ display: { xs: "none", sm: "inline-flex" }, gridColumn: { md: 3 }, gridRow: { md: 1 }, justifySelf: "end", whiteSpace: "nowrap" }}
            />
          </Toolbar>
        </Container>
        <Box sx={{ borderTop: { md: "1px solid #d8e0eb" } }}>
          <Container maxWidth="xl">
            <Tabs
              value={tab}
              onChange={(_, value: number) => selectTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Dashboard sections"
            >
              {DASHBOARD_TAB_LABELS.map((label) => (
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
          sx={{ display: { xs: "none", sm: "flex" }, mb: { sm: 2, md: 3 } }}
        >
          <Box>
            <Typography component="h2" variant="h2">
              {DASHBOARD_TAB_LABELS[tab]}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
              <Typography color="text.secondary" variant="body2">
                {TAB_DESCRIPTIONS[tab]}
              </Typography>
              {tab === 0 ? (
                <Tooltip
                  arrow
                  placement="bottom-start"
                  open={scoringTooltipUsesClick ? scoringTooltipOpen : undefined}
                  onClose={() => setScoringTooltipOpen(false)}
                  disableFocusListener={scoringTooltipUsesClick}
                  disableHoverListener={scoringTooltipUsesClick}
                  disableTouchListener={scoringTooltipUsesClick}
                  title={(
                    <Box sx={{ maxWidth: 340, py: 0.5 }}>
                      <Typography variant="caption" sx={{ display: "block", fontWeight: 900 }}>Group stage</Typography>
                      <Typography variant="caption" sx={{ display: "block" }}>
                        {state.scoring.rules.groupExactPosition} points per exact current position, plus {state.scoring.rules.groupExactBonus} points when the entire current group is correct.
                      </Typography>
                      <Typography variant="caption" sx={{ display: "block", fontWeight: 900, mt: 0.75 }}>Knockouts</Typography>
                      <Typography variant="caption" sx={{ display: "block" }}>
                        Round of 16: {state.scoring.rules.knockoutAdvancementByRound.R32} · Quarterfinals: {state.scoring.rules.knockoutAdvancementByRound.R16} · Semifinals: {state.scoring.rules.knockoutAdvancementByRound.QF} · Final: {state.scoring.rules.knockoutAdvancementByRound.SF} · Champion: {state.scoring.rules.knockoutAdvancementByRound.F}
                      </Typography>
                    </Box>
                  )}
                >
                  <IconButton
                    size="small"
                    aria-label="Show scoring rules"
                    aria-expanded={scoringTooltipUsesClick ? scoringTooltipOpen : undefined}
                    onClick={scoringTooltipUsesClick ? () => setScoringTooltipOpen((open) => !open) : undefined}
                    sx={{ p: 0.25, color: "text.secondary" }}
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          </Box>
        </Stack>

        {tab === 0 ? <Leaderboard state={state} teamMap={teamMap} /> : null}
        {tab === 1 ? <GroupsView state={state} teamMap={teamMap} /> : null}
        {tab === 2 ? <KnockoutView state={state} teamMap={teamMap} /> : null}
        {tab === 3 ? <ScheduleView state={state} teamMap={teamMap} /> : null}
      </Container>
    </Box>
  );
}
