import { z } from "zod";

export const inputSchema = z.object({
  sequence: z.number().int().nonnegative(),
  moveX: z.number().finite().min(-1).max(1),
  moveZ: z.number().finite().min(-1).max(1),
  aimX: z.number().finite().min(-1).max(1),
  aimZ: z.number().finite().min(-1).max(1),
  jump: z.boolean(),
  sprint: z.boolean(),
  throwBall: z.boolean(),
  hook: z.boolean(),
});

export const teamSchema = z.object({ team: z.enum(["coral", "teal"]) });
