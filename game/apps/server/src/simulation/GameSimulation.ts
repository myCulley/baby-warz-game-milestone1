import RAPIER from "@dimforge/rapier3d-compat";
import {
  ARENA_BLOCKERS,
  BALL_SPAWNS,
  FOOD_IDS,
  FOOD_SPAWNS,
  TEAM_SPAWNS,
  TUNING,
  clamp,
  copyVec3,
  distanceSquared,
  foodModifiers,
  normalized2,
  stackCount,
  type BallSnapshot,
  type FoodId,
  type FoodSnapshot,
  type HookSnapshot,
  type InputCommand,
  type MatchPhase,
  type PlayerSnapshot,
  type Team,
  type WorldSnapshot,
} from "@baby-warz/shared";

interface PlayerRuntime extends PlayerSnapshot {
  input: InputCommand;
  sprintUntil: number;
  armAt: number;
  hookReadyAt: number;
  grounded: boolean;
}

interface BallRuntime extends BallSnapshot {
  spawnIndex: number;
  thrownAt?: number;
  hitPlayerId?: string;
  throwerId?: string;
}

interface FoodRuntime extends FoodSnapshot {
  cycleAt: number;
}

const idleInput = (): InputCommand => ({
  sequence: 0,
  moveX: 0,
  moveZ: 0,
  aimX: 0,
  aimZ: 1,
  jump: false,
  sprint: false,
  throwBall: false,
  hook: false,
});

export class GameSimulation {
  readonly players = new Map<string, PlayerRuntime>();
  readonly balls = new Map<string, BallRuntime>();
  readonly foods = new Map<string, FoodRuntime>();
  readonly hooks = new Map<string, HookSnapshot>();
  phase: MatchPhase = "lobby";
  hostId?: string;
  winner?: Team | "draw";
  matchStartedAt = 0;
  private nextEntity = 1;
  private rapierReady = false;

  async initializePhysics(): Promise<void> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: TUNING.gravity, z: 0 });
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        TUNING.arenaHalfWidth,
        0.1,
        TUNING.arenaHalfLength,
      ),
    );
    this.rapierReady = true;
  }

  addPlayer(
    id: string,
    name: string,
    role: "player" | "spectator",
    now = Date.now(),
  ): PlayerSnapshot {
    const disambiguated = this.uniqueName(name);
    const player: PlayerRuntime = {
      id,
      name: disambiguated,
      role,
      position: { x: 0, y: 1.1, z: role === "spectator" ? 30 : -20 },
      velocity: { x: 0, y: 0, z: 0 },
      facing: 0,
      hearts: TUNING.baseHearts,
      maxHearts: TUNING.baseHearts,
      balls: 0,
      foods: [],
      hookCooldownMs: 0,
      eliminated: role === "spectator",
      connected: true,
      acknowledgedSequence: 0,
      hitsDealt: 0,
      hitsReceived: 0,
      input: idleInput(),
      sprintUntil: 0,
      armAt: now,
      hookReadyAt: now,
      grounded: true,
    };
    this.players.set(id, player);
    if (!this.hostId && role === "player") this.hostId = id;
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    if (this.hostId === id) this.hostId = this.activePlayers()[0]?.id;
  }

  setConnected(id: string, connected: boolean): void {
    const player = this.players.get(id);
    if (player) player.connected = connected;
  }

  forfeit(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    if (this.phase === "playing" && !player.eliminated)
      player.eliminated = true;
    else this.removePlayer(id);
  }

  setTeam(id: string, team: Team): boolean {
    if (this.phase !== "lobby") return false;
    const player = this.players.get(id);
    if (!player || player.role !== "player") return false;
    if (
      this.teamPlayers(team).filter((value) => value.id !== id).length >=
      TUNING.maxPlayersPerTeam
    )
      return false;
    player.team = team;
    return true;
  }

  startMatch(
    requesterId: string,
    now = Date.now(),
  ): { ok: boolean; reason?: string } {
    if (requesterId !== this.hostId)
      return { ok: false, reason: "Only the host can start." };
    if (this.phase !== "lobby")
      return { ok: false, reason: "A match is already active." };
    if (
      this.teamPlayers("coral").length < 1 ||
      this.teamPlayers("teal").length < 1
    ) {
      return { ok: false, reason: "Each team needs at least one baby." };
    }
    this.phase = "playing";
    this.winner = undefined;
    this.matchStartedAt = now;
    this.balls.clear();
    this.foods.clear();
    this.hooks.clear();
    for (const team of ["coral", "teal"] as const) {
      const shuffledSpawns = [...TEAM_SPAWNS[team]].sort(
        () => Math.random() - 0.5,
      );
      this.teamPlayers(team).forEach((player, index) => {
        player.position = copyVec3(shuffledSpawns[index] ?? shuffledSpawns[0]!);
        player.velocity = { x: 0, y: 0, z: 0 };
        player.hearts = TUNING.baseHearts;
        player.maxHearts = TUNING.baseHearts;
        player.balls = 0;
        player.foods = [];
        player.eliminated = false;
        player.hitsDealt = 0;
        player.hitsReceived = 0;
        this.spawnBall(team, index);
      });
      this.refreshFoodSpawns(team, now);
    }
    return { ok: true };
  }

  resetLobby(): void {
    this.phase = "lobby";
    this.winner = undefined;
    this.balls.clear();
    this.foods.clear();
    this.hooks.clear();
    for (const player of this.players.values()) {
      player.role = "player";
      player.team = undefined;
      player.foods = [];
      player.balls = 0;
      player.hearts = TUNING.baseHearts;
      player.maxHearts = TUNING.baseHearts;
      player.eliminated = false;
      player.position = { x: 0, y: 1.1, z: -20 };
      player.velocity = { x: 0, y: 0, z: 0 };
      player.facing = 0;
      player.hookCooldownMs = 0;
      player.hitsDealt = 0;
      player.hitsReceived = 0;
      player.acknowledgedSequence = 0;
      player.input = idleInput();
      player.sprintUntil = 0;
      player.armAt = 0;
      player.hookReadyAt = 0;
      player.grounded = true;
    }
    this.hostId = this.activePlayers()[0]?.id;
  }

  queueInput(id: string, command: InputCommand): void {
    const player = this.players.get(id);
    if (!player || command.sequence <= player.acknowledgedSequence) return;
    player.input = command;
  }

  step(now = Date.now(), dt = 1 / TUNING.tickRate): void {
    if (this.phase !== "playing") return;
    for (const player of this.activePlayers()) this.stepPlayer(player, now, dt);
    this.resolvePlayerCollisions();
    for (const ball of [...this.balls.values()]) this.stepBall(ball, now, dt);
    this.stepFoods(now);
    for (const [id, hook] of this.hooks) {
      hook.remainingMs -= dt * 1000;
      if (hook.remainingMs <= 0) this.hooks.delete(id);
    }
    this.resolveEnd(now);
  }

  snapshot(now = Date.now()): WorldSnapshot {
    return {
      serverTime: now,
      phase: this.phase,
      hostId: this.hostId,
      remainingMs:
        this.phase === "playing"
          ? Math.max(0, TUNING.matchDurationMs - (now - this.matchStartedAt))
          : 0,
      players: [...this.players.values()].map(
        ({
          input: _input,
          sprintUntil: _s,
          armAt: _a,
          hookReadyAt: _h,
          grounded: _g,
          ...value
        }) => ({ ...value }),
      ),
      balls: [...this.balls.values()].map(
        ({ spawnIndex: _i, thrownAt: _t, hitPlayerId: _h, ...value }) => ({
          ...value,
        }),
      ),
      foods: [...this.foods.values()].map(({ cycleAt: _c, ...value }) => ({
        ...value,
      })),
      hooks: [...this.hooks.values()],
      winner: this.winner,
    };
  }

  private stepPlayer(player: PlayerRuntime, now: number, dt: number): void {
    if (player.eliminated || !player.connected) return;
    const command = player.input;
    const modifiers = foodModifiers(player.foods);
    if (command.sprint && now >= player.sprintUntil)
      player.sprintUntil = now + TUNING.sprintDurationMs;
    const sprint = now < player.sprintUntil ? TUNING.sprintMultiplier : 1;
    const movement = normalized2(command.moveX, command.moveZ);
    const speed = TUNING.baseSpeed * modifiers.speedMultiplier * sprint;
    const control = player.grounded ? 1 : 0.45 * modifiers.airControlMultiplier;
    player.velocity.x +=
      (movement.x * speed - player.velocity.x) *
      Math.min(1, dt * 11 * modifiers.accelerationMultiplier * control);
    player.velocity.z +=
      (movement.z * speed - player.velocity.z) *
      Math.min(1, dt * 11 * modifiers.accelerationMultiplier * control);
    if (command.jump && player.grounded) {
      player.velocity.y = TUNING.jumpVelocity * modifiers.jumpMultiplier;
      player.grounded = false;
    }
    player.velocity.y += TUNING.gravity * dt;
    player.position.x = clamp(
      player.position.x + player.velocity.x * dt,
      -TUNING.arenaHalfWidth + 1,
      TUNING.arenaHalfWidth - 1,
    );
    player.position.y += player.velocity.y * dt;
    player.position.z = clamp(
      player.position.z + player.velocity.z * dt,
      -TUNING.arenaHalfLength + 1,
      TUNING.arenaHalfLength - 1,
    );
    this.resolveArenaBlockers(player);
    if (player.position.y <= 1.1 * modifiers.scale) {
      player.position.y = 1.1 * modifiers.scale;
      player.velocity.y = 0;
      player.grounded = true;
    }
    if (Math.hypot(command.aimX, command.aimZ) > 0.2)
      player.facing = Math.atan2(command.aimX, command.aimZ);
    if (Math.abs(player.position.z) < TUNING.riverHalfWidth)
      this.eliminate(player);
    if (command.throwBall) this.tryThrow(player, now);
    if (command.hook) this.tryHook(player, now);
    player.acknowledgedSequence = command.sequence;
    player.input = {
      ...command,
      jump: false,
      sprint: false,
      throwBall: false,
      hook: false,
    };
    player.hookCooldownMs = Math.max(0, player.hookReadyAt - now);
  }

  private tryThrow(player: PlayerRuntime, now: number): void {
    if (player.balls < 1 || now < player.armAt) return;
    let direction = { x: Math.sin(player.facing), z: Math.cos(player.facing) };
    const carrotStacks = stackCount(player.foods, "carrot");
    if (carrotStacks > 0) {
      const target = this.teamPlayers(
        player.team === "coral" ? "teal" : "coral",
      )
        .filter((candidate) => !candidate.eliminated)
        .map((candidate) => {
          const delta = normalized2(
            candidate.position.x - player.position.x,
            candidate.position.z - player.position.z,
          );
          const alignment = delta.x * direction.x + delta.z * direction.z;
          return { delta, alignment, candidate };
        })
        .filter(
          ({ alignment, candidate }) =>
            alignment > 0.78 &&
            distanceSquared(candidate.position, player.position) < 24 ** 2,
        )
        .sort((a, b) => b.alignment - a.alignment)[0];
      if (target) {
        const assist = carrotStacks * 0.08;
        direction = normalized2(
          direction.x * (1 - assist) + target.delta.x * assist,
          direction.z * (1 - assist) + target.delta.z * assist,
        );
      }
    }
    const power = foodModifiers(player.foods).throwMultiplier;
    const ball: BallRuntime = {
      id: `ball-${this.nextEntity++}`,
      team: player.team!,
      position: {
        x: player.position.x + direction.x * 1.2,
        y: player.position.y + 0.45,
        z: player.position.z + direction.z * 1.2,
      },
      velocity: {
        x: direction.x * TUNING.ballSpeed * power,
        y: 1.8,
        z: direction.z * TUNING.ballSpeed * power,
      },
      active: true,
      bounceCount: 0,
      spawnIndex: 0,
      thrownAt: now,
      throwerId: player.id,
    };
    this.balls.set(ball.id, ball);
    player.balls -= 1;
    player.armAt = now + (player.balls > 0 ? TUNING.reserveArmMs : 0);
  }

  private tryHook(player: PlayerRuntime, now: number): void {
    if (now < player.hookReadyAt) return;
    const modifiers = foodModifiers(player.foods);
    player.hookReadyAt =
      now + TUNING.hookCooldownMs * modifiers.hookCooldownMultiplier;
    const direction = {
      x: Math.sin(player.facing),
      z: Math.cos(player.facing),
    };
    const end = {
      x: player.position.x + direction.x * TUNING.hookRange,
      y: player.position.y,
      z: player.position.z + direction.z * TUNING.hookRange,
    };
    let targetId: string | undefined;
    let targetType: HookSnapshot["targetType"] = "terrain";
    let best = 2.4 ** 2;
    for (const ball of this.balls.values()) {
      const lineDistance = this.distanceToAimLine(player, ball.position);
      if (!ball.heldBy && lineDistance < best) {
        best = lineDistance;
        targetId = ball.id;
        targetType = "ball";
      }
    }
    for (const target of this.activePlayers()) {
      if (target.id === player.id || target.eliminated) continue;
      const lineDistance = this.distanceToAimLine(player, target.position);
      if (lineDistance < best) {
        best = lineDistance;
        targetId = target.id;
        targetType = "player";
      }
    }
    if (targetType === "ball" && targetId) {
      const ball = this.balls.get(targetId);
      if (ball) {
        if (player.balls < TUNING.maxBallSlots) player.balls += 1;
        this.balls.delete(ball.id);
        Object.assign(end, ball.position);
      }
    } else if (targetType === "player" && targetId) {
      const target = this.players.get(targetId);
      if (target) {
        const targetMass = foodModifiers(target.foods).mass;
        const fraction = 0.25 / targetMass;
        target.position.x += (player.position.x - target.position.x) * fraction;
        target.position.z += (player.position.z - target.position.z) * fraction;
        Object.assign(end, target.position);
        if (Math.abs(target.position.z) < TUNING.riverHalfWidth)
          this.eliminate(target);
      }
    } else {
      player.position.x += direction.x * (5 / modifiers.mass);
      player.position.z += direction.z * (5 / modifiers.mass);
    }
    this.hooks.set(player.id, {
      ownerId: player.id,
      targetId,
      targetType,
      end,
      remainingMs: TUNING.hookDurationMs,
    });
  }

  private distanceToAimLine(
    player: PlayerRuntime,
    target: { x: number; y: number; z: number },
  ): number {
    const dx = target.x - player.position.x,
      dz = target.z - player.position.z;
    const forward = dx * Math.sin(player.facing) + dz * Math.cos(player.facing);
    if (forward < 0 || forward > TUNING.hookRange)
      return Number.POSITIVE_INFINITY;
    const lateral = dx * Math.cos(player.facing) - dz * Math.sin(player.facing);
    return lateral * lateral;
  }

  private stepBall(ball: BallRuntime, now: number, dt: number): void {
    if (ball.heldBy) return;
    if (
      ball.thrownAt !== undefined &&
      now - ball.thrownAt >= TUNING.ballDespawnMs
    ) {
      this.respawnBall(ball);
      return;
    }
    ball.velocity.y += TUNING.gravity * dt;
    ball.position.x += ball.velocity.x * dt;
    ball.position.y += ball.velocity.y * dt;
    ball.position.z += ball.velocity.z * dt;
    this.resolveBallBlockers(ball);
    if (
      Math.abs(ball.position.x) > TUNING.arenaHalfWidth - 0.35 ||
      Math.abs(ball.position.z) > TUNING.arenaHalfLength - 0.35
    ) {
      ball.velocity.x *=
        Math.abs(ball.position.x) > TUNING.arenaHalfWidth - 0.35 ? -0.65 : 0.65;
      ball.velocity.z *=
        Math.abs(ball.position.z) > TUNING.arenaHalfLength - 0.35
          ? -0.65
          : 0.65;
      ball.bounceCount += 1;
      ball.position.x = clamp(
        ball.position.x,
        -TUNING.arenaHalfWidth + 0.35,
        TUNING.arenaHalfWidth - 0.35,
      );
      ball.position.z = clamp(
        ball.position.z,
        -TUNING.arenaHalfLength + 0.35,
        TUNING.arenaHalfLength - 0.35,
      );
    }
    if (ball.position.y <= 0.4) {
      ball.position.y = 0.4;
      if (Math.abs(ball.velocity.y) > 1) {
        ball.velocity.y *= -0.45;
        ball.bounceCount += 1;
      } else ball.velocity.y = 0;
      ball.velocity.x *= 0.94;
      ball.velocity.z *= 0.94;
    }
    if (ball.bounceCount >= TUNING.maxTerrainBounces) ball.active = false;
    if (ball.active && !ball.hitPlayerId) {
      for (const player of this.activePlayers()) {
        if (
          player.eliminated ||
          player.team === ball.team ||
          distanceSquared(player.position, ball.position) > 1.25 ** 2
        )
          continue;
        player.hearts -= 1;
        player.hitsReceived += 1;
        const thrower = ball.throwerId
          ? this.players.get(ball.throwerId)
          : undefined;
        if (thrower) thrower.hitsDealt += 1;
        const blueberryResistance =
          1 - stackCount(player.foods, "blueberries") * 0.18;
        const peasPenalty = 1 + stackCount(player.foods, "peas") * 0.12;
        const applesaucePenalty =
          1 + stackCount(player.foods, "applesauce") * 0.12;
        const incoming = normalized2(ball.velocity.x, ball.velocity.z);
        const impulse =
          (3.5 * blueberryResistance * peasPenalty * applesaucePenalty) /
          foodModifiers(player.foods).mass;
        player.velocity.x += incoming.x * impulse;
        player.velocity.z += incoming.z * impulse;
        ball.hitPlayerId = player.id;
        ball.active = false;
        if (player.hearts <= 0) this.eliminate(player);
        this.respawnBall(ball);
        return;
      }
    }
    for (const player of this.activePlayers()) {
      if (
        player.eliminated ||
        player.balls >= TUNING.maxBallSlots ||
        distanceSquared(player.position, ball.position) >
          TUNING.ballPickupRadius ** 2
      )
        continue;
      player.balls += 1;
      this.balls.delete(ball.id);
      return;
    }
  }

  private stepFoods(now: number): void {
    for (const team of ["coral", "teal"] as const) {
      for (const food of [...this.foods.values()].filter(
        (value) => value.team === team,
      )) {
        if (now >= food.cycleAt) {
          food.available = !food.available;
          food.cycleAt =
            now + (food.available ? TUNING.foodVisibleMs : TUNING.foodAbsentMs);
          if (food.available)
            food.food = FOOD_IDS[Math.floor(Math.random() * FOOD_IDS.length)]!;
        }
        if (!food.available) continue;
        for (const player of this.teamPlayers(team)) {
          if (
            player.eliminated ||
            player.foods.length >= TUNING.maxFoods ||
            distanceSquared(player.position, food.position) > 1.3 ** 2
          )
            continue;
          player.foods.push(food.food);
          const modifiers = foodModifiers(player.foods);
          const previousMax = player.maxHearts;
          player.maxHearts = TUNING.baseHearts + modifiers.maxHeartsBonus;
          player.hearts += player.maxHearts - previousMax;
          food.available = false;
          food.cycleAt = now + TUNING.foodAbsentMs;
          break;
        }
      }
      this.refreshFoodSpawns(team, now);
    }
  }

  private refreshFoodSpawns(team: Team, now: number): void {
    const eligible = this.teamPlayers(team).filter(
      (player) => !player.eliminated && player.foods.length < TUNING.maxFoods,
    ).length;
    const wanted = Math.min(eligible, FOOD_SPAWNS[team].length);
    const existing = [...this.foods.values()].filter(
      (food) => food.team === team,
    );
    while (existing.length < wanted) {
      const index = existing.length;
      const food: FoodRuntime = {
        id: `food-${team}-${index}`,
        team,
        food: FOOD_IDS[Math.floor(Math.random() * FOOD_IDS.length)]!,
        position: copyVec3(FOOD_SPAWNS[team][index]!),
        available: true,
        cycleAt: now + TUNING.foodVisibleMs,
      };
      this.foods.set(food.id, food);
      existing.push(food);
    }
    for (const food of existing.slice(wanted)) this.foods.delete(food.id);
  }

  private resolveEnd(now: number): void {
    const aliveCoral = this.teamPlayers("coral").filter(
      (player) => !player.eliminated,
    ).length;
    const aliveTeal = this.teamPlayers("teal").filter(
      (player) => !player.eliminated,
    ).length;
    if (
      aliveCoral === 0 ||
      aliveTeal === 0 ||
      now - this.matchStartedAt >= TUNING.matchDurationMs
    ) {
      this.phase = "summary";
      this.winner =
        aliveCoral === aliveTeal
          ? "draw"
          : aliveCoral > aliveTeal
            ? "coral"
            : "teal";
    }
  }

  private eliminate(player: PlayerRuntime): void {
    player.eliminated = true;
    player.balls = 0;
    player.velocity = { x: 0, y: 0, z: 0 };
  }
  private resolvePlayerCollisions(): void {
    const players = this.activePlayers().filter((player) => !player.eliminated);
    for (let leftIndex = 0; leftIndex < players.length; leftIndex += 1) {
      const left = players[leftIndex]!;
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < players.length;
        rightIndex += 1
      ) {
        const right = players[rightIndex]!;
        const dx = right.position.x - left.position.x;
        const dz = right.position.z - left.position.z;
        const distance = Math.hypot(dx, dz) || 0.001;
        const minimum =
          TUNING.playerRadius *
          (foodModifiers(left.foods).scale + foodModifiers(right.foods).scale);
        if (distance >= minimum) continue;
        const overlap = minimum - distance;
        const leftMass = foodModifiers(left.foods).mass;
        const rightMass = foodModifiers(right.foods).mass;
        const totalMass = leftMass + rightMass;
        left.position.x -= (dx / distance) * overlap * (rightMass / totalMass);
        left.position.z -= (dz / distance) * overlap * (rightMass / totalMass);
        right.position.x += (dx / distance) * overlap * (leftMass / totalMass);
        right.position.z += (dz / distance) * overlap * (leftMass / totalMass);
      }
    }
  }
  private resolveArenaBlockers(player: PlayerRuntime): void {
    const radius = TUNING.playerRadius * foodModifiers(player.foods).scale;
    for (const blocker of ARENA_BLOCKERS) {
      const nearestX = clamp(
        player.position.x,
        blocker.centerX - blocker.halfWidth,
        blocker.centerX + blocker.halfWidth,
      );
      const nearestZ = clamp(
        player.position.z,
        blocker.centerZ - blocker.halfLength,
        blocker.centerZ + blocker.halfLength,
      );
      const dx = player.position.x - nearestX;
      const dz = player.position.z - nearestZ;
      if (dx * dx + dz * dz >= radius * radius) continue;
      const pushX =
        blocker.halfWidth +
        radius -
        Math.abs(player.position.x - blocker.centerX);
      const pushZ =
        blocker.halfLength +
        radius -
        Math.abs(player.position.z - blocker.centerZ);
      if (pushX < pushZ) {
        player.position.x =
          blocker.centerX +
          Math.sign(player.position.x - blocker.centerX || 1) *
            (blocker.halfWidth + radius);
        player.velocity.x = 0;
      } else {
        player.position.z =
          blocker.centerZ +
          Math.sign(player.position.z - blocker.centerZ || 1) *
            (blocker.halfLength + radius);
        player.velocity.z = 0;
      }
    }
  }
  private resolveBallBlockers(ball: BallRuntime): void {
    const radius = 0.39;
    for (const blocker of ARENA_BLOCKERS) {
      if (
        ball.position.x < blocker.centerX - blocker.halfWidth - radius ||
        ball.position.x > blocker.centerX + blocker.halfWidth + radius ||
        ball.position.z < blocker.centerZ - blocker.halfLength - radius ||
        ball.position.z > blocker.centerZ + blocker.halfLength + radius ||
        ball.position.y > 2.1
      )
        continue;
      const overlapX =
        blocker.halfWidth +
        radius -
        Math.abs(ball.position.x - blocker.centerX);
      const overlapZ =
        blocker.halfLength +
        radius -
        Math.abs(ball.position.z - blocker.centerZ);
      if (overlapX < overlapZ) {
        ball.position.x =
          blocker.centerX +
          Math.sign(ball.position.x - blocker.centerX || 1) *
            (blocker.halfWidth + radius);
        ball.velocity.x *= -0.65;
      } else {
        ball.position.z =
          blocker.centerZ +
          Math.sign(ball.position.z - blocker.centerZ || 1) *
            (blocker.halfLength + radius);
        ball.velocity.z *= -0.65;
      }
      ball.bounceCount += 1;
    }
  }
  private spawnBall(team: Team, spawnIndex: number): void {
    const position = copyVec3(
      BALL_SPAWNS[team][spawnIndex] ?? BALL_SPAWNS[team][0]!,
    );
    const ball: BallRuntime = {
      id: `spawn-${team}-${spawnIndex}`,
      team,
      position,
      velocity: { x: 0, y: 0, z: 0 },
      active: false,
      bounceCount: TUNING.maxTerrainBounces,
      spawnIndex,
    };
    this.balls.set(ball.id, ball);
  }
  private respawnBall(ball: BallRuntime): void {
    ball.position = copyVec3(
      BALL_SPAWNS[ball.team][ball.spawnIndex] ?? BALL_SPAWNS[ball.team][0]!,
    );
    ball.velocity = { x: 0, y: 0, z: 0 };
    ball.active = false;
    ball.bounceCount = TUNING.maxTerrainBounces;
    ball.thrownAt = undefined;
    ball.hitPlayerId = undefined;
    ball.throwerId = undefined;
  }
  private teamPlayers(team: Team): PlayerRuntime[] {
    return this.activePlayers().filter((player) => player.team === team);
  }
  private activePlayers(): PlayerRuntime[] {
    return [...this.players.values()].filter(
      (player) => player.role === "player",
    );
  }
  private uniqueName(input: string): string {
    const base = input.trim().slice(0, 18) || "Baby";
    const names = new Set(
      [...this.players.values()].map((player) => player.name),
    );
    if (!names.has(base)) return base;
    let suffix = 2;
    while (names.has(`${base} #${suffix}`)) suffix += 1;
    return `${base} #${suffix}`;
  }
}
