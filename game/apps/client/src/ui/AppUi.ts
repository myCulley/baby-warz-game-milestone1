import { FOODS, type WorldSnapshot } from "@baby-warz/shared";
import type { Identity, NetworkClient } from "../net/NetworkClient";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ]!,
  );

export class AppUi {
  private joined = false;
  private lastLobbyKey = "";
  constructor(
    private readonly root: HTMLElement,
    private readonly network: NetworkClient,
  ) {}

  landing(
    onJoin: (name: string, intent: "create" | "join") => Promise<void>,
  ): void {
    this.root.innerHTML = `<main class="landing panel"><div class="eyebrow">A TINY BRAWL WITH BIG DIAPERS</div><h1>Baby <span>Warz</span></h1><p>Throw dodgeballs. Hook your friends. Do not touch the river.</p><form id="entry"><label for="name">Your playground name</label><input id="name" maxlength="18" autocomplete="nickname" placeholder="Captain Crumbs" required /><div class="actions"><button name="intent" value="join">Join existing</button><button class="primary" name="intent" value="create">Create lobby</button></div></form><small>WASD move · Space jump · Shift sprint · Left click hook · Right click throw</small></main>`;
    this.root
      .querySelector("form")!
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        if (this.joined) return;
        this.joined = true;
        const submitter = (event as SubmitEvent).submitter as HTMLButtonElement;
        const name = (this.root.querySelector("#name") as HTMLInputElement)
          .value;
        try {
          await onJoin(name, submitter.value as "create" | "join");
        } catch (error) {
          this.joined = false;
          this.toast(
            error instanceof Error ? error.message : "Could not join.",
          );
        }
      });
  }

  render(
    snapshot: WorldSnapshot | undefined,
    identity: Identity | undefined,
  ): void {
    if (!snapshot || !identity) return;
    const me = snapshot.players.find((player) => player.id === identity.id);
    const notice = this.network.notice
      ? `<div class="notice">${escapeHtml(this.network.notice)}</div>`
      : "";
    if (snapshot.phase === "lobby") {
      const lobbyKey = JSON.stringify({
        hostId: snapshot.hostId,
        notice: this.network.notice,
        players: snapshot.players.map(({ id, name, role, team }) => ({
          id,
          name,
          role,
          team,
        })),
      });
      if (lobbyKey === this.lastLobbyKey) return;
      this.lastLobbyKey = lobbyKey;
      const coral = snapshot.players.filter(
        (player) => player.team === "coral",
      );
      const teal = snapshot.players.filter((player) => player.team === "teal");
      this.root.innerHTML = `<main class="lobby panel"><div class="eyebrow">FORMING LOBBY</div><h2>Pick a riverbank</h2><div class="teams"><button data-team="coral" class="team coral"><b>Coral chevrons</b><span>${coral.length}/6</span><small>${coral.map((p) => escapeHtml(p.name)).join(" · ") || "Waiting…"}</small></button><button data-team="teal" class="team teal"><b>Teal bars</b><span>${teal.length}/6</span><small>${teal.map((p) => escapeHtml(p.name)).join(" · ") || "Waiting…"}</small></button></div>${identity.id === snapshot.hostId ? `<button class="primary start" data-start>Start match</button>` : `<p>Waiting for the host to start…</p>`}${notice}</main>`;
      this.root
        .querySelectorAll<HTMLElement>("[data-team]")
        .forEach((button) =>
          button.addEventListener("click", () =>
            this.network.chooseTeam(button.dataset.team as "coral" | "teal"),
          ),
        );
      this.root
        .querySelector<HTMLElement>("[data-start]")
        ?.addEventListener("click", () => this.network.start());
      return;
    }
    if (snapshot.phase === "summary") {
      const rows = snapshot.players
        .filter((player) => player.role === "player")
        .map(
          (player) =>
            `<tr><td>${escapeHtml(player.name)}</td><td>${player.hitsDealt}</td><td>${player.hitsReceived}</td><td>${player.foods.map((food) => FOODS.find((value) => value.id === food)?.glyph).join(" + ") || "—"}</td></tr>`,
        )
        .join("");
      this.root.innerHTML = `<main class="summary panel"><div class="eyebrow">MATCH COMPLETE</div><h2>${snapshot.winner === "draw" ? "Draw!" : `${snapshot.winner?.toUpperCase()} wins!`}</h2><table><thead><tr><th>Baby</th><th>Hits</th><th>Bonks</th><th>Foods</th></tr></thead><tbody>${rows}</tbody></table>${identity.id === snapshot.hostId ? `<button class="primary" data-continue>Fresh lobby</button>` : `<p>Waiting for the host…</p>`}</main>`;
      this.root
        .querySelector<HTMLElement>("[data-continue]")
        ?.addEventListener("click", () => this.network.continue());
      return;
    }
    const coralAlive = snapshot.players.filter(
      (player) => player.team === "coral" && !player.eliminated,
    ).length;
    const tealAlive = snapshot.players.filter(
      (player) => player.team === "teal" && !player.eliminated,
    ).length;
    const time = `${Math.floor(snapshot.remainingMs / 60000)}:${String(Math.floor((snapshot.remainingMs % 60000) / 1000)).padStart(2, "0")}`;
    const foodSlots = [0, 1, 2]
      .map((index) => {
        const id = me?.foods[index];
        const food = FOODS.find((value) => value.id === id);
        return `<span class="food-slot" title="${food?.description ?? "Empty food slot"}">${food?.glyph ?? "·"}</span>`;
      })
      .join("");
    this.root.innerHTML = `<header class="matchbar"><div class="score coral">◆ ${coralAlive}</div><div class="timer"><small>LAST TEAM STANDING</small><b>${time}</b></div><div class="score teal">${tealAlive} ▰</div></header><aside class="status left"><b>${me?.name ?? "Spectator"}</b><div class="hearts">${"♥".repeat(me?.hearts ?? 0)}${"♡".repeat(Math.max(0, (me?.maxHearts ?? 0) - (me?.hearts ?? 0)))}</div><div>${foodSlots}</div></aside><aside class="status right"><div><small>RIGHT HAND</small><b>${me?.balls ?? 0} BALL${me?.balls === 1 ? "" : "S"}</b></div><div><small>LEFT HAND</small><b>${me?.hookCooldownMs ? `${(me.hookCooldownMs / 1000).toFixed(1)}s` : "HOOK READY"}</b></div></aside>${identity.role === "spectator" || me?.eliminated ? `<div class="spectating">SPECTATING · right-drag rotate · wheel zoom</div>` : ""}${notice}`;
  }

  toast(message: string): void {
    this.root.insertAdjacentHTML(
      "beforeend",
      `<div class="notice">${escapeHtml(message)}</div>`,
    );
  }
}
