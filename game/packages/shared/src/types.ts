export type Team = "coral" | "teal";
export type Role = "player" | "spectator";
export type MatchPhase = "lobby" | "playing" | "summary";
export type FoodId =
  | "spinach"
  | "potato"
  | "banana"
  | "carrot"
  | "blueberries"
  | "watermelon"
  | "oatmeal"
  | "peas"
  | "applesauce";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface InputCommand {
  sequence: number;
  moveX: number;
  moveZ: number;
  aimX: number;
  aimZ: number;
  jump: boolean;
  sprint: boolean;
  throwBall: boolean;
  hook: boolean;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  role: Role;
  team?: Team;
  position: Vec3;
  velocity: Vec3;
  facing: number;
  hearts: number;
  maxHearts: number;
  balls: number;
  foods: FoodId[];
  hookCooldownMs: number;
  eliminated: boolean;
  connected: boolean;
  acknowledgedSequence: number;
  hitsDealt: number;
  hitsReceived: number;
}

export interface BallSnapshot {
  id: string;
  team: Team;
  position: Vec3;
  velocity: Vec3;
  active: boolean;
  bounceCount: number;
  heldBy?: string;
}

export interface FoodSnapshot {
  id: string;
  team: Team;
  food: FoodId;
  position: Vec3;
  available: boolean;
}

export interface HookSnapshot {
  ownerId: string;
  targetId?: string;
  targetType?: "terrain" | "player" | "ball";
  end: Vec3;
  remainingMs: number;
}

export interface WorldSnapshot {
  serverTime: number;
  phase: MatchPhase;
  hostId?: string;
  remainingMs: number;
  players: PlayerSnapshot[];
  balls: BallSnapshot[];
  foods: FoodSnapshot[];
  hooks: HookSnapshot[];
  winner?: Team | "draw";
}

export interface JoinOptions {
  name: string;
  intent: "create" | "join";
  reconnectToken?: string;
}

export interface TeamMessage {
  team: Team;
}
