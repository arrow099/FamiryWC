"use client";

import { Box, Paper, Stack, Typography } from "@mui/material";
import { flagForTeam } from "@/lib/app-data/teamDisplay";
import type { KnockoutPick, Pick, RoundId, Team } from "@/lib/schemas/appData";

const ROUND_LABELS: Record<RoundId, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  F: "Final",
};
const CARD_WIDTH = 132;
const COLUMN_GAP = 8;
const SIDE_MIN_WIDTH = CARD_WIDTH * 4 + COLUMN_GAP * 3;
const FINAL_LANE_WIDTH = CARD_WIDTH + 72;
const ROW_HEIGHT = 86;
const SIDE_ROWS = 8;

function TeamLabel({ teamMap, teamId }: { teamMap: Map<string, Team>; teamId: string }) {
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

function MobileScrollHint({ children }: { children: string }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" }, fontWeight: 700 }}>
      {children}
    </Typography>
  );
}

function rowStart(roundDepth: number, matchIndex: number): number {
  return matchIndex * 2 ** roundDepth + 1;
}

function rowSpan(roundDepth: number): number {
  return 2 ** roundDepth;
}

function TeamRow({ teamMap, teamId, winnerId }: { teamMap: Map<string, Team>; teamId: string; winnerId: string }) {
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
        "& .MuiBox-root": { color: "inherit" },
      }}
    >
      <TeamLabel teamMap={teamMap} teamId={teamId} />
    </Box>
  );
}

function MatchCard({ match, teamMap }: { match: KnockoutPick; teamMap: Map<string, Team> }) {
  return (
    <Paper variant="outlined" sx={{ bgcolor: "background.paper", p: 0.5, position: "relative", width: CARD_WIDTH }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.62rem", fontWeight: 800, lineHeight: 1, mb: 0.4 }}>
        Match {match.bracketId}
      </Typography>
      <Stack spacing={0.5}>
        <TeamRow teamMap={teamMap} teamId={match.team1Id} winnerId={match.winnerId} />
        <TeamRow teamMap={teamMap} teamId={match.team2Id} winnerId={match.winnerId} />
      </Stack>
    </Paper>
  );
}

type SideRound = {
  depth: number;
  matches: KnockoutPick[];
  round: Exclude<RoundId, "F">;
};

function SideGrid({ rounds, teamMap }: { rounds: SideRound[]; teamMap: Map<string, Team> }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: `repeat(${rounds.length}, minmax(${CARD_WIDTH}px, 1fr))`,
        gridTemplateRows: `repeat(${SIDE_ROWS}, ${ROW_HEIGHT}px)`,
        justifyItems: "center",
        minWidth: SIDE_MIN_WIDTH,
        position: "relative",
        width: "100%",
      }}
    >
      {rounds.map(({ depth, matches, round }, roundIndex) => (
        <Box key={round} sx={{ display: "contents" }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              alignSelf: "start",
              fontSize: "0.65rem",
              fontWeight: 900,
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
            {ROUND_LABELS[round]}
          </Typography>
          {matches.map((match, matchIndex) => (
            <Box
              key={match.slotId}
              sx={{
                alignSelf: "center",
                gridColumn: roundIndex + 1,
                gridRow: `${rowStart(depth, matchIndex)} / span ${rowSpan(depth)}`,
                justifySelf: "center",
                position: "relative",
              }}
            >
              <MatchCard match={match} teamMap={teamMap} />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function LegacyKnockoutView({ pick, teamMap }: { pick: Pick; teamMap: Map<string, Team> }) {
  const leftRounds: SideRound[] = [
    { depth: 0, matches: pick.knockout.R32.slice(0, 8), round: "R32" },
    { depth: 1, matches: pick.knockout.R16.slice(0, 4), round: "R16" },
    { depth: 2, matches: pick.knockout.QF.slice(0, 2), round: "QF" },
    { depth: 3, matches: pick.knockout.SF.slice(0, 1), round: "SF" },
  ];
  const rightRounds: SideRound[] = [
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
        <MobileScrollHint>Scroll horizontally to inspect the full bracket</MobileScrollHint>
      </Stack>
      <Box sx={{ overflowX: "auto", px: { xs: 1.5, sm: 2.5 }, pb: 2.5, pt: 4.5, scrollbarWidth: "thin" }}>
        <Box
          sx={{
            alignItems: "stretch",
            display: "grid",
            gap: 1,
            gridTemplateColumns: `minmax(${SIDE_MIN_WIDTH}px, 1fr) ${FINAL_LANE_WIDTH}px minmax(${SIDE_MIN_WIDTH}px, 1fr)`,
            minWidth: SIDE_MIN_WIDTH * 2 + FINAL_LANE_WIDTH + COLUMN_GAP * 2,
            width: "100%",
          }}
        >
          <SideGrid rounds={leftRounds} teamMap={teamMap} />
          <Box sx={{ alignItems: "center", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: `repeat(${SIDE_ROWS}, ${ROW_HEIGHT}px)`, justifyItems: "center", width: "100%" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ alignSelf: "start", fontSize: "0.65rem", fontWeight: 900, gridColumn: "1", gridRow: "1", justifySelf: "center", letterSpacing: 0, textAlign: "center", textTransform: "uppercase", transform: "translateY(-22px)", whiteSpace: "nowrap" }}
            >
              {ROUND_LABELS.F}
            </Typography>
            {final ? (
              <Box sx={{ alignSelf: "center", gridColumn: "1", gridRow: `1 / span ${SIDE_ROWS}`, justifySelf: "center" }}>
                <MatchCard match={final} teamMap={teamMap} />
              </Box>
            ) : null}
          </Box>
          <SideGrid rounds={rightRounds} teamMap={teamMap} />
        </Box>
      </Box>
    </Paper>
  );
}
