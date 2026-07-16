import { beforeEach, describe, expect, it } from "vitest";
import { TUNING } from "@baby-warz/shared";
import { GameSimulation } from "./GameSimulation.js";

describe("authoritative match simulation", () => {
  let game: GameSimulation;
  beforeEach(() => {
    game = new GameSimulation();
    game.addPlayer("host", "Host", "player", 0);
    game.addPlayer("guest", "Guest", "player", 0);
    game.setTeam("host", "coral");
    game.setTeam("guest", "teal");
  });

  it("requires the host and both teams to start", () => {
    expect(game.startMatch("guest", 0).ok).toBe(false);
    expect(game.startMatch("host", 0).ok).toBe(true);
  });

  it("enforces ball capacity and food slot limits", () => {
    game.startMatch("host", 0);
    const host = game.players.get("host")!;
    host.balls = TUNING.maxBallSlots;
    for (const ball of game.balls.values())
      ball.position = { ...host.position };
    game.step(50, 0.05);
    expect(host.balls).toBe(3);
    host.foods = ["spinach", "potato", "banana"];
    for (const food of game.foods.values())
      food.position = { ...host.position };
    game.step(100, 0.05);
    expect(host.foods).toHaveLength(3);
  });

  it("ignores stale and duplicate input sequences", () => {
    game.startMatch("host", 0);
    const command = {
      sequence: 2,
      moveX: 1,
      moveZ: 0,
      aimX: 1,
      aimZ: 0,
      jump: false,
      sprint: false,
      throwBall: false,
      hook: false,
    };
    game.queueInput("host", command);
    game.step(50, 0.05);
    game.queueInput("host", { ...command, sequence: 1, moveX: -1 });
    game.step(100, 0.05);
    expect(game.players.get("host")!.acknowledgedSequence).toBe(2);
  });

  it("eliminates immediately on river contact", () => {
    game.startMatch("host", 0);
    const host = game.players.get("host")!;
    host.position.z = 0;
    game.step(50, 0.05);
    expect(host.eliminated).toBe(true);
    expect(game.phase).toBe("summary");
  });

  it("keeps players out of the authored low-cover blockers", () => {
    game.startMatch("host", 0);
    const host = game.players.get("host")!;
    host.position = { x: -9.2, y: 1.1, z: -15.4 };
    game.step(50, 0.05);
    expect(host.position.z <= -17.85 || host.position.z >= -12.95).toBe(true);
  });

  it("resolves the 30-minute limit by survivors and allows a draw", () => {
    game.startMatch("host", 0);
    game.step(TUNING.matchDurationMs + 1, 0.05);
    expect(game.phase).toBe("summary");
    expect(game.winner).toBe("draw");
  });

  it("returns to a genuinely fresh lobby", () => {
    game.startMatch("host", 0);
    const playedHost = game.players.get("host")!;
    playedHost.foods = ["spinach"];
    playedHost.balls = 3;
    playedHost.hitsDealt = 4;
    playedHost.hitsReceived = 2;
    playedHost.velocity = { x: 3, y: 2, z: 1 };
    playedHost.acknowledgedSequence = 12;
    game.players.get("guest")!.eliminated = true;
    game.step(50, 0.05);
    game.resetLobby();
    const host = game.players.get("host")!;
    expect({
      phase: game.phase,
      team: host.team,
      foods: host.foods,
      balls: host.balls,
      hitsDealt: host.hitsDealt,
      hitsReceived: host.hitsReceived,
      velocity: host.velocity,
      acknowledgedSequence: host.acknowledgedSequence,
    }).toEqual({
      phase: "lobby",
      team: undefined,
      foods: [],
      balls: 0,
      hitsDealt: 0,
      hitsReceived: 0,
      velocity: { x: 0, y: 0, z: 0 },
      acknowledgedSequence: 0,
    });
  });
});
