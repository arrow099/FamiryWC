"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { flagForTeam } from "@/lib/app-data/teamDisplay";
import type { AppState, Team } from "@/lib/schemas/appData";
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

export function LegacyGroupsView({ state, teamMap }: { state: AppState; teamMap: Map<string, Team> }) {
  const [selectedMemberId, setSelectedMemberId] = useState(state.members[0]?.id ?? "");
  const pick = state.picks.find((candidate) => candidate.memberId === selectedMemberId) ?? state.picks[0];

  if (!pick) return null;

  const thirdPlaceAdvancers = new Set(pick.thirdPlaceAdvancers);

  return (
    <Stack spacing={2}>
      <FormControl size="small" sx={{ minWidth: { sm: 240 }, width: { xs: "100%", sm: 280 }, alignSelf: { sm: "flex-end" } }}>
        <InputLabel id="legacy-groups-member-select-label">Member</InputLabel>
        <Select
          labelId="legacy-groups-member-select-label"
          label="Member"
          value={selectedMemberId}
          onChange={(event) => setSelectedMemberId(event.target.value)}
        >
          {state.members.map((member) => (
            <MenuItem key={member.id} value={member.id}>
              {member.displayName}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
    </Stack>
  );
}
