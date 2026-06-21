import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchDetailsDialog } from "@/components/MatchDetailsDialog";
import { useEspnPlayByPlay } from "@/hooks/useEspnPlayByPlay";
import type { Match, Team } from "@/lib/schemas/appData";

vi.mock("@/hooks/useEspnPlayByPlay", () => ({ useEspnPlayByPlay: vi.fn() }));

const teams = new Map<string, Team>([
  ["team_mex", { id: "team_mex", name: "Mexico", abbr: "MEX", providerIds: { local: 1, espn: "1", fifa: null } }],
  ["team_rsa", { id: "team_rsa", name: "South Africa", abbr: "RSA", providerIds: { local: 2, espn: "2", fifa: null } }],
]);
const match: Match = {
  id: "match_001",
  providerIds: { espn: "401000001" },
  stage: "group",
  round: "FIFA World Cup, Group A",
  group: "A",
  kickoffAt: "2026-06-21T20:00:00Z",
  status: "in",
  statusText: "In Progress",
  clock: "22'",
  homeTeamId: "team_mex",
  awayTeamId: "team_rsa",
  homeTeamName: "Mexico",
  awayTeamName: "South Africa",
  homeScore: 1,
  awayScore: 0,
  winnerTeamId: null,
  venue: { name: null, city: null, country: null },
};

describe("MatchDetailsDialog", () => {
  beforeEach(() => {
    vi.mocked(useEspnPlayByPlay).mockReturnValue({
      entries: [], capturedAt: null, loading: false, refreshing: false, message: null,
    });
  });

  it("shows a pending message without enabling play-by-play", () => {
    render(<MatchDetailsDialog match={{ ...match, status: "pre" }} teamMap={teams} onClose={vi.fn()} />);

    expect(screen.getByText(/This game has not started yet/)).toBeInTheDocument();
    expect(useEspnPlayByPlay).toHaveBeenCalledWith("401000001", false, false);
  });

  it("shows live notes without the field visualization", () => {
    vi.mocked(useEspnPlayByPlay).mockReturnValue({
      entries: [{
        id: "play_1",
        sequence: 1,
        clock: "22'",
        text: "Shot by Mexico.",
        type: "Shot",
        teamName: "Mexico",
        participants: [],
        fieldPosition: { x: 0.72, y: 0.4 },
      }],
      capturedAt: "2026-06-21T20:22:00Z",
      loading: false,
      refreshing: false,
      message: null,
    });
    const onClose = vi.fn();
    render(<MatchDetailsDialog match={match} teamMap={teams} onClose={onClose} />);

    expect(screen.getByText("Updates every 10 seconds")).toBeInTheDocument();
    expect(screen.getByLabelText("Play-by-play notes")).toHaveTextContent("Shot by Mexico.");
    expect(screen.queryByText("Last play position")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close match details" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
