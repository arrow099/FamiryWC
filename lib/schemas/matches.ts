import { z } from "zod";

export const espnFixtureSchema = z.object({
  events: z.array(z.unknown()).default([]),
});

export type EspnFixture = z.infer<typeof espnFixtureSchema>;
