import { Client, Room } from "colyseus";
import pino from "pino";
import { TUNING, type JoinOptions } from "@baby-warz/shared";
import { inputSchema, teamSchema } from "../schemas/messages.js";
import { GameSimulation } from "../simulation/GameSimulation.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

export class BabyWarzRoom extends Room {
  maxClients = TUNING.maxPlayers + TUNING.maxSpectators;
  private readonly simulation = new GameSimulation();

  async onCreate(): Promise<void> {
    await this.simulation.initializePhysics();
    this.setSimulationInterval(
      () => this.simulation.step(),
      1000 / TUNING.tickRate,
    );
    this.clock.setInterval(
      () => this.broadcast("snapshot", this.simulation.snapshot()),
      1000 / TUNING.snapshotRate,
    );
    this.onMessage("input", (client, value) => {
      const parsed = inputSchema.safeParse(value);
      if (parsed.success)
        this.simulation.queueInput(client.sessionId, parsed.data);
    });
    this.onMessage("team", (client, value) => {
      const parsed = teamSchema.safeParse(value);
      if (
        !parsed.success ||
        !this.simulation.setTeam(client.sessionId, parsed.data.team)
      )
        client.send("notice", "That team is full or unavailable.");
    });
    this.onMessage("start", (client) => {
      const result = this.simulation.startMatch(client.sessionId);
      if (!result.ok) client.send("notice", result.reason);
    });
    this.onMessage("continue", (client) => {
      if (
        this.simulation.phase === "summary" &&
        client.sessionId === this.simulation.hostId
      )
        this.simulation.resetLobby();
    });
    log.info({ roomId: this.roomId }, "Baby Warz room created");
  }

  onJoin(client: Client, options: JoinOptions): void {
    const playerCount = this.simulation
      .snapshot()
      .players.filter((player) => player.role === "player").length;
    const role =
      this.simulation.phase === "playing" || playerCount >= TUNING.maxPlayers
        ? "spectator"
        : "player";
    const player = this.simulation.addPlayer(
      client.sessionId,
      options.name,
      role,
    );
    client.send("identity", {
      id: client.sessionId,
      name: player.name,
      role,
      reconnectToken: client.reconnectionToken,
    });
    if (
      options.intent === "create" &&
      this.simulation.hostId !== client.sessionId
    ) {
      client.send(
        "notice",
        this.simulation.phase === "playing"
          ? "A match is active; you joined as a spectator."
          : "A lobby already exists; you joined it.",
      );
    }
    log.info(
      { playerId: client.sessionId, role, name: player.name },
      "client joined",
    );
  }

  async onLeave(client: Client, code?: number): Promise<void> {
    this.simulation.setConnected(client.sessionId, false);
    if (code === 1000) {
      this.simulation.forfeit(client.sessionId);
      return;
    }
    try {
      await this.allowReconnection(client, TUNING.reconnectGraceMs / 1000);
      this.simulation.setConnected(client.sessionId, true);
    } catch {
      this.simulation.forfeit(client.sessionId);
    }
  }
}
