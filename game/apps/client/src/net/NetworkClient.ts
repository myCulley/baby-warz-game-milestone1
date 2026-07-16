import { Client, type Room } from "@colyseus/sdk";
import type {
  InputCommand,
  JoinOptions,
  Team,
  WorldSnapshot,
} from "@baby-warz/shared";

export interface Identity {
  id: string;
  name: string;
  role: "player" | "spectator";
  reconnectToken: string;
}

export class NetworkClient {
  private readonly client: Client;
  private room?: Room;
  identity?: Identity;
  snapshot?: WorldSnapshot;
  notice = "";
  onUpdate?: () => void;

  constructor(endpoint: string) {
    this.client = new Client(endpoint);
  }

  async connect(options: JoinOptions): Promise<void> {
    this.room = await this.client.joinOrCreate("baby_warz", options);
    this.bindRoom();
  }

  async reconnect(): Promise<boolean> {
    const token = sessionStorage.getItem("baby-warz-reconnect");
    const identity = sessionStorage.getItem("baby-warz-identity");
    if (!token || !identity) return false;
    try {
      this.room = await this.client.reconnect(token);
      this.identity = JSON.parse(identity) as Identity;
      this.bindRoom();
      return true;
    } catch {
      sessionStorage.removeItem("baby-warz-reconnect");
      sessionStorage.removeItem("baby-warz-identity");
      return false;
    }
  }

  private bindRoom(): void {
    if (!this.room) return;
    this.room.onMessage("identity", (identity: Identity) => {
      this.identity = identity;
      sessionStorage.setItem(
        "baby-warz-reconnect",
        this.room!.reconnectionToken || identity.reconnectToken,
      );
      sessionStorage.setItem("baby-warz-identity", JSON.stringify(identity));
      this.onUpdate?.();
    });
    this.room.onMessage("snapshot", (snapshot: WorldSnapshot) => {
      this.snapshot = snapshot;
      const player = snapshot.players.find(
        (candidate) => candidate.id === this.identity?.id,
      );
      if (this.identity && player) {
        this.identity = {
          ...this.identity,
          name: player.name,
          role: player.role,
        };
        sessionStorage.setItem(
          "baby-warz-identity",
          JSON.stringify(this.identity),
        );
      }
      this.onUpdate?.();
    });
    this.room.onMessage("notice", (message: string) => {
      this.notice = message;
      this.onUpdate?.();
    });
    this.room.onError((code, message) => {
      this.notice = `Connection error ${code}: ${message}`;
      this.onUpdate?.();
    });
    this.room.onLeave(() => {
      this.notice =
        "Disconnected. Refresh within 15 seconds to reclaim your baby.";
      this.onUpdate?.();
    });
  }

  sendInput(input: InputCommand): void {
    this.room?.send("input", input);
  }
  chooseTeam(team: Team): void {
    this.room?.send("team", { team });
  }
  start(): void {
    this.room?.send("start");
  }
  continue(): void {
    this.room?.send("continue");
  }
}
