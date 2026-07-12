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
  ballRestSpeed: 0.3,
  ballRestRespawnMs: 3000,
  maxTerrainBounces: 2,
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

export const TEAM_SPAWNS: Record<Team, Vec3[]> = {
  coral: [
    { x: -12, y: 1.1, z: -21 },
    { x: -7, y: 1.1, z: -23 },
    { x: -2, y: 1.1, z: -21 },
    { x: 3, y: 1.1, z: -23 },
    { x: 8, y: 1.1, z: -21 },
    { x: 13, y: 1.1, z: -23 },
  ],
  teal: [
    { x: -12, y: 1.1, z: 21 },
    { x: -7, y: 1.1, z: 23 },
    { x: -2, y: 1.1, z: 21 },
    { x: 3, y: 1.1, z: 23 },
    { x: 8, y: 1.1, z: 21 },
    { x: 13, y: 1.1, z: 23 },
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
    { x: -11, y: 0.6, z: -12 },
    { x: 0, y: 0.6, z: -15 },
    { x: 11, y: 0.6, z: -12 },
  ],
  teal: [
    { x: -11, y: 0.6, z: 12 },
    { x: 0, y: 0.6, z: 15 },
    { x: 11, y: 0.6, z: 12 },
  ],
};
