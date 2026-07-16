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

  it("despawns a missed throw after three motionless seconds", () => {
    game.startMatch("host", 0);
    game.balls.clear();
    const host = game.players.get("host")!;
    host.balls = 1;
    game.queueInput("host", {
      sequence: 1,
      moveX: 0,
      moveZ: 0,
      aimX: 1,
      aimZ: 0,
      jump: false,
      sprint: false,
      throwBall: true,
      hook: false,
    });

    game.step(0, 0.05);
    const thrown = [...game.balls.values()][0]!;
    expect(thrown.active).toBe(true);

    thrown.velocity = { x: 0, y: 0, z: 0 };
    thrown.position.y = 0.4;
    game.step(1_000, 0);
    expect(thrown.active).toBe(false);
    expect(game.snapshot(1_000).balls).toHaveLength(1);

    game.step(1_000 + TUNING.ballMotionlessDespawnMs - 1, 0);
    expect(thrown.active).toBe(false);
    expect(game.snapshot(3_999).balls).toHaveLength(1);

    game.step(1_000 + TUNING.ballMotionlessDespawnMs, 0);
    expect(game.snapshot(4_000).balls).toHaveLength(0);
  });

  it("keeps a thrown ball threatening while it is still moving", () => {
    game.startMatch("host", 0);
    game.balls.clear();
    const host = game.players.get("host")!;
    host.balls = 1;
    game.queueInput("host", {
      sequence: 1,
      moveX: 0,
      moveZ: 0,
      aimX: 1,
      aimZ: 0,
      jump: false,
      sprint: false,
      throwBall: true,
      hook: false,
    });

    game.step(0, 0);
    const thrown = [...game.balls.values()][0]!;
    thrown.velocity = { x: 1, y: 0, z: 0 };
    game.step(TUNING.ballMotionlessDespawnMs + 1, 0);

    expect(thrown.active).toBe(true);
    expect(
      game.snapshot(TUNING.ballMotionlessDespawnMs + 1).balls,
    ).toHaveLength(1);
  });

  it("counts a moving enemy contact and despawns the ball immediately", () => {
    game.startMatch("host", 0);
    game.balls.clear();
    const host = game.players.get("host")!;
    const guest = game.players.get("guest")!;
    host.balls = 1;
    guest.position = {
      x: host.position.x + 1.2,
      y: host.position.y + 0.45,
      z: host.position.z,
    };
    game.queueInput("host", {
      sequence: 1,
      moveX: 0,
      moveZ: 0,
      aimX: 1,
      aimZ: 0,
      jump: false,
      sprint: false,
      throwBall: true,
      hook: false,
    });

    game.step(0, 0);

    expect(host.hitsDealt).toBe(1);
    expect(guest.hitsReceived).toBe(1);
    expect(guest.hearts).toBe(TUNING.baseHearts - 1);
    expect(game.snapshot(0).balls).toHaveLength(0);
  });

  it("does not turn a bounced projectile into an enemy pickup", () => {
    game.startMatch("host", 0);
    game.balls.clear();
    const host = game.players.get("host")!;
    const guest = game.players.get("guest")!;
    host.balls = 1;
    game.queueInput("host", {
      sequence: 1,
      moveX: 0,
      moveZ: 0,
      aimX: 1,
      aimZ: 0,
      jump: false,
      sprint: false,
      throwBall: true,
      hook: false,
    });
    game.step(0, 0.05);
    const thrown = [...game.balls.values()][0]!;
    thrown.bounceCount = 2;
    thrown.position = { ...guest.position };
    thrown.velocity = { x: 1, y: 0, z: 0 };

    game.step(50, 0);

    expect(guest.balls).toBe(0);
    expect(guest.hitsReceived).toBe(1);
    expect(host.hitsDealt).toBe(1);
    expect(game.snapshot(50).balls).toHaveLength(0);
  });

  it("starts a 1v1 with one ball per side and supplies up to team capacity", () => {
    game.startMatch("host", 0);
    expect(
      [...game.balls.values()].filter((ball) => ball.team === "coral"),
    ).toHaveLength(1);
    expect(
      [...game.balls.values()].filter((ball) => ball.team === "teal"),
    ).toHaveLength(1);

    const host = game.players.get("host")!;
    const first = [...game.balls.values()].find(
      (ball) => ball.team === "coral",
    )!;
    first.position = { ...host.position };
    game.step(1, 0);
    expect(host.balls).toBe(1);

    game.step(TUNING.ballSpawnIntervalMs - 1, 0);
    expect(
      [...game.balls.values()].filter((ball) => ball.team === "coral"),
    ).toHaveLength(0);
    game.step(TUNING.ballSpawnIntervalMs, 0);
    const second = [...game.balls.values()].find(
      (ball) => ball.team === "coral",
    )!;
    second.position = { ...host.position };
    game.step(TUNING.ballSpawnIntervalMs + 1, 0);
    expect(host.balls).toBe(2);

    game.step(TUNING.ballSpawnIntervalMs * 2, 0);
    const third = [...game.balls.values()].find(
      (ball) => ball.team === "coral",
    )!;
    third.position = { ...host.position };
    game.step(TUNING.ballSpawnIntervalMs * 2 + 1, 0);
    expect(host.balls).toBe(3);

    game.step(TUNING.ballSpawnIntervalMs * 3, 0);
    expect(
      [...game.balls.values()].filter((ball) => ball.team === "coral"),
    ).toHaveLength(0);
  });

  it("leaves an untouched spawn ball on its pad indefinitely", () => {
    game.startMatch("host", 0);
    game.step(5 * 60_000, 0);
    expect(
      [...game.balls.values()].filter((ball) => ball.team === "coral"),
    ).toHaveLength(1);
  });

  it("bounces a moving throw off a friendly player without damage", () => {
    game.addPlayer("friend", "Friend", "player", 0);
    game.setTeam("friend", "coral");
    game.startMatch("host", 0);
    game.balls.clear();
    const host = game.players.get("host")!;
    const friend = game.players.get("friend")!;
    game.balls.set("friendly", {
      id: "friendly",
      team: "coral",
      position: { ...friend.position },
      velocity: { x: 5, y: 0, z: 0 },
      active: true,
      bounceCount: 0,
      spawnIndex: 0,
      thrownAt: 0,
      throwerId: host.id,
    });

    game.step(50, 0);

    const ball = game.balls.get("friendly")!;
    expect(friend.hitsReceived).toBe(0);
    expect(friend.hearts).toBe(TUNING.baseHearts);
    expect(ball.bounceCount).toBe(1);
    expect(ball.velocity.x).toBeLessThan(0);
  });

  it("lets a grappling hook catch a moving enemy ball without taking a hit", () => {
    game.startMatch("host", 0);
    game.balls.clear();
    const host = game.players.get("host")!;
    const guest = game.players.get("guest")!;
    guest.position = { x: 0, y: 1.1, z: 0 };
    guest.facing = 0;
    game.balls.set("hookable", {
      id: "hookable",
      team: "coral",
      position: { x: 0, y: 1.1, z: 5 },
      velocity: { x: 0, y: 0, z: -10 },
      active: true,
      bounceCount: 0,
      spawnIndex: 0,
      thrownAt: 0,
      throwerId: host.id,
    });
    game.queueInput("guest", {
      sequence: 1,
      moveX: 0,
      moveZ: 0,
      aimX: 0,
      aimZ: 1,
      jump: false,
      sprint: false,
      throwBall: false,
      hook: true,
    });

    game.step(50, 0.05);

    expect(guest.balls).toBe(1);
    expect(guest.hitsReceived).toBe(0);
    expect(game.balls.has("hookable")).toBe(false);
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
