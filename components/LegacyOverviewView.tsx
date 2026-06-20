"use client";

import type { ReactNode } from "react";
import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { flagForTeam } from "@/lib/app-data/teamDisplay";
import type { AppState, GroupId, Team } from "@/lib/schemas/appData";
import { GROUP_IDS } from "@/lib/schemas/appData";

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

export function LegacyOverviewView({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const championCounts = countBy(state.picks, (pick) => pick.championPick);
  const topGroupPicks = GROUP_IDS.map((group) => {
    const top = countBy(state.picks, (pick) => pick.groups[group][0]?.teamId)[0];
    return {
      group,
      label: <TeamLabel teamMap={teamMap} teamId={top?.[0]} />,
      count: top?.[1] ?? 0,
    };
  });
  const topThirdPlacePicks = countBy(
    state.picks.flatMap((pick) => pick.thirdPlaceAdvancers),
    (teamId) => teamId,
  );

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Box sx={{ display: "grid", gap: { xs: 1.5, md: 2 }, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
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

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" } }}>
        <Box sx={{ display: "flex", minWidth: 0 }}>
          <Card sx={{ width: "100%" }}>
            <CardContent>
              <Typography variant="h3" sx={{ mb: 2 }}>Champion Picks</Typography>
              <Bars rows={championCounts} teamMap={teamMap} />
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ display: "flex", minWidth: 0 }}>
          <Card sx={{ width: "100%" }}>
            <CardContent>
              <Typography variant="h3" sx={{ mb: 2 }}>Top Group Picks</Typography>
              <GroupConsensusList rows={topGroupPicks} />
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ display: "flex", minWidth: 0 }}>
          <Card sx={{ width: "100%" }}>
            <CardContent>
              <Typography variant="h3" sx={{ mb: 2 }}>Top Third-Place Picks</Typography>
              <Bars rows={topThirdPlacePicks} teamMap={teamMap} />
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Stack>
  );
}
