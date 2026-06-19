import { z } from "zod";

export const sourceTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  abbr: z.string(),
});

export type SourceTeam = z.infer<typeof sourceTeamSchema>;

const knockoutMatchSchema = z.object({
  team1: sourceTeamSchema,
  team2: sourceTeamSchema,
  winner: sourceTeamSchema,
  bracketId: z.number(),
});

export const sourcePlayerSchema = z.object({
  name: z.string(),
  groupMap: z.record(z.record(sourceTeamSchema)),
  thirdPlace: z.array(sourceTeamSchema),
  knockout: z.record(z.array(knockoutMatchSchema)),
});

export const familyPicksSchema = z.object({
  schemaVersion: z.number(),
  source: z.object({
    type: z.string(),
    file: z.string(),
    extractedFrom: z.string(),
    extractedAt: z.string(),
  }),
  summary: z.record(z.unknown()),
  teams: z.array(sourceTeamSchema),
  players: z.array(sourcePlayerSchema),
});

export type FamilyPicksSource = z.infer<typeof familyPicksSchema>;
