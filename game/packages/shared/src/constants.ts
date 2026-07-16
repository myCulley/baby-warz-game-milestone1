import type { Team, Vec3 } from "./types.js";

export const TUNING = {
  tickRate: 20,
  snapshotRate: 20,
  arenaHalfWidth: 18,
  arenaHalfLength: 28,
  riverHalfWidth: 2.2,
  playerRadius: 0.75,
  playerHeight: 2.2,
  baseSpeed: 6.2,
  sprintMultiplier: 1.5,
  sprintDurationMs: 3000,
  jumpVelocity: 8.5,
  gravity: -22,
  baseHearts: 3,
  maxBallSlots: 3,
  reserveArmMs: 250,
  ballSpeed: 17,
  ballPickupRadius: 1.25,
  ballDespawnMs: 3000,
  hookCooldownMs: 3000,
  hookRange: 14,
  hookDurationMs: 500,
  matchDurationMs: 30 * 60 * 1000,
  reconnectGraceMs: 15_000,
  foodVisibleMs: 60_000,
  foodAbsentMs: 15_000,
  maxFoods: 3,
  maxPlayersPerTeam: 6,
  maxPlayers: 12,
  maxSpectators: 12,
  reconciliationSnapDistance: 2.5,
} as const;

export interface ArenaBlocker {
  id: string;
  centerX: number;
  centerZ: number;
  halfWidth: number;
  halfLength: number;
}

// Authored in vertical-slice-2/arena-layout.json. These simple boxes are the
// server contract; the detailed visual mesh is never used for collision.
export const ARENA_BLOCKERS: readonly ArenaBlocker[] = [
  {
    id: "coral-west-cover",
    centerX: -9.2,
    centerZ: -15.4,
    halfWidth: 3,
    halfLength: 1.7,
  },
  {
    id: "coral-east-cover",
    centerX: 9,
    centerZ: -9,
    halfWidth: 3,
    halfLength: 1.7,
  },
  {
    id: "teal-west-cover",
    centerX: -9,
    centerZ: 9,
    halfWidth: 3,
    halfLength: 1.7,
  },
  {
    id: "teal-east-cover",
    centerX: 9.2,
    centerZ: 15.4,
    halfWidth: 3,
    halfLength: 1.7,
  },
] as const;

export const TEAM_SPAWNS: Record<Team, Vec3[]> = {
  coral: [
    { x: -2.25, y: 1.1, z: -23.8 },
    { x: 0, y: 1.1, z: -23.8 },
    { x: 2.25, y: 1.1, z: -23.8 },
    { x: -2.25, y: 1.1, z: -21.55 },
    { x: 0, y: 1.1, z: -21.55 },
    { x: 2.25, y: 1.1, z: -21.55 },
  ],
  teal: [
    { x: -2.25, y: 1.1, z: 23.8 },
    { x: 0, y: 1.1, z: 23.8 },
    { x: 2.25, y: 1.1, z: 23.8 },
    { x: -2.25, y: 1.1, z: 21.55 },
    { x: 0, y: 1.1, z: 21.55 },
    { x: 2.25, y: 1.1, z: 21.55 },
  ],
};

export const BALL_SPAWNS: Record<Team, Vec3[]> = {
  coral: Array.from({ length: 6 }, (_, index) => ({
    x: -12 + index * 4.8,
    y: 0.45,
    z: -5,
  })),
  teal: Array.from({ length: 6 }, (_, index) => ({
    x: -12 + index * 4.8,
    y: 0.45,
    z: 5,
  })),
};

export const FOOD_SPAWNS: Record<Team, Vec3[]> = {
  coral: [
    { x: -8, y: 0.62, z: -6 },
    { x: 0, y: 0.62, z: -10 },
    { x: 8, y: 0.62, z: -6 },
  ],
  teal: [
    { x: -8, y: 0.62, z: 6 },
    { x: 0, y: 0.62, z: 10 },
    { x: 8, y: 0.62, z: 6 },
  ],
};
