import "@babylonjs/core/Engines/WebGPU/Extensions/engine.alpha";
import { Engine, WebGPUEngine } from "@babylonjs/core";
import { TUNING } from "@baby-warz/shared";
import { InputController } from "./game/InputController";
import { NetworkClient } from "./net/NetworkClient";
import { ArenaScene } from "./scenes/ArenaScene";
import { AppUi } from "./ui/AppUi";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const uiRoot = document.querySelector<HTMLElement>("#ui")!;
const endpoint =
  import.meta.env.VITE_SERVER_URL ||
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
const network = new NetworkClient(endpoint);
const ui = new AppUi(uiRoot, network);

async function createEngine(): Promise<Engine> {
  if (await WebGPUEngine.IsSupportedAsync) {
    const engine = new WebGPUEngine(canvas, { antialias: true });
    await engine.initAsync();
    return engine as unknown as Engine;
  }
  const context = canvas.getContext("webgl2");
  if (!context)
    throw new Error(
      "Baby Warz needs WebGPU or WebGL 2. Try a current Opera GX, Chrome, Edge, or Firefox build.",
    );
  return new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
  });
}

async function boot(): Promise<void> {
  const engine = await createEngine();
  const input = new InputController(canvas);
  const arena = new ArenaScene(
    engine,
    () => network.identity?.id,
    () =>
      network.identity?.role === "spectator" ||
      Boolean(
        network.snapshot?.players.find((p) => p.id === network.identity?.id)
          ?.eliminated,
      ),
  );
  canvas.addEventListener("pointermove", (event) => {
    const me = network.snapshot?.players.find(
      (player) => player.id === network.identity?.id,
    );
    const aim = arena.setAimFromPointer(
      event.clientX,
      event.clientY,
      me?.position,
    );
    if (aim) input.aim = aim;
  });
  network.onUpdate = () => {
    if (network.snapshot) arena.update(network.snapshot);
    arena.enableSpectatorControls(canvas);
    ui.render(network.snapshot, network.identity);
  };
  if (!(await network.reconnect()))
    ui.landing(async (name, intent) => network.connect({ name, intent }));
  let accumulator = 0,
    previous = performance.now();
  engine.runRenderLoop(() => {
    const now = performance.now();
    accumulator += now - previous;
    previous = now;
    if (
      network.snapshot?.phase === "playing" &&
      network.identity?.role === "player" &&
      accumulator >= 1000 / TUNING.tickRate
    ) {
      network.sendInput(input.next());
      accumulator = 0;
    }
    arena.scene.render();
  });
  window.addEventListener("resize", () => engine.resize());
}

boot().catch((error) => {
  uiRoot.innerHTML = `<main class="panel unsupported"><h1>Baby Warz</h1><p>${error instanceof Error ? error.message : "This browser cannot start the arena."}</p></main>`;
});
