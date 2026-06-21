"use client";

import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { useEspnPlayByPlay } from "@/hooks/useEspnPlayByPlay";
import { flagForTeam } from "@/lib/app-data/teamDisplay";
import type { Match, Team } from "@/lib/schemas/appData";

function teamText(teamMap: Map<string, Team>, teamId: string | null, fallback: string | null): string {
  const team = teamId ? teamMap.get(teamId) : null;
  return team ? `${flagForTeam(team)} ${team.abbr}` : fallback ?? "TBD";
}

function kickoffText(value: string | null): string {
  if (!value) return "Kickoff time is still to be determined.";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function MatchDetailsDialog({
  match,
  teamMap,
  onClose,
}: {
  match: Match | null;
  teamMap: Map<string, Team>;
  onClose: () => void;
}) {
  const isOpen = match !== null;
  const isPending = match?.status === "pre";
  const playByPlay = useEspnPlayByPlay(match?.providerIds.espn ?? null, isOpen && !isPending, match?.status === "in");

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="match-details-title">
      {match ? (
        <>
          <DialogTitle id="match-details-title" sx={{ pr: 7 }}>
            <Stack spacing={0.5}>
              <Typography component="span" variant="h3">
                {teamText(teamMap, match.homeTeamId, match.homeTeamName)} vs {teamText(teamMap, match.awayTeamId, match.awayTeamName)}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={match.group ? `Group ${match.group}` : match.round} />
                {match.status === "in" ? <Chip size="small" color="error" label={`LIVE ${match.clock ?? ""}`.trim()} /> : null}
                {match.status !== "pre" ? (
                  <Typography component="span" fontWeight={900}>{match.homeScore ?? 0} - {match.awayScore ?? 0}</Typography>
                ) : null}
              </Stack>
            </Stack>
            <IconButton aria-label="Close match details" onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {isPending ? (
              <Alert severity="info">
                This game has not started yet. Kickoff is {kickoffText(match.kickoffAt)}
              </Alert>
            ) : (
              <Stack spacing={2}>
                {playByPlay.loading ? <LinearProgress aria-label="Loading play-by-play" /> : null}
                {playByPlay.message ? <Alert severity="warning">{playByPlay.message}</Alert> : null}
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="h3">Play by play</Typography>
                    {match.status === "in" ? <Typography variant="caption" color="text.secondary">Updates every 10 seconds</Typography> : null}
                  </Stack>
                  <Divider />
                  {!playByPlay.loading && playByPlay.entries.length === 0 && !playByPlay.message ? (
                    <Alert severity="info" sx={{ mt: 1 }}>Play-by-play is not available for this game.</Alert>
                  ) : (
                    <List disablePadding aria-label="Play-by-play notes">
                      {playByPlay.entries.map((entry) => (
                        <ListItem key={entry.id} divider alignItems="flex-start" sx={{ px: 0 }}>
                          <Box sx={{ color: "text.secondary", flex: "0 0 48px", fontSize: "0.8rem", fontWeight: 900, pt: 0.4 }}>
                            {entry.clock || "-"}
                          </Box>
                          <ListItemText
                            primary={entry.text}
                            secondary={[entry.type, entry.teamName].filter(Boolean).join(" · ") || undefined}
                            primaryTypographyProps={{ variant: "body2" }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </Stack>
            )}
          </DialogContent>
        </>
      ) : null}
    </Dialog>
  );
}
