import type { InputCommand } from "@baby-warz/shared";

export class InputController {
  private readonly keys = new Set<string>();
  private sequence = 0;
  private sprint = false;
  private jump = false;
  private throwBall = false;
  private hook = false;
  aim = { x: 0, z: 1 };

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (event) => {
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Space",
          "ShiftLeft",
          "ShiftRight",
        ].includes(event.code)
      )
        event.preventDefault();
      this.keys.add(event.code);
      if (event.code === "Space") this.jump = true;
      if (event.code.startsWith("Shift")) this.sprint = true;
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 0) this.hook = true;
      if (event.button === 2) this.throwBall = true;
    });
  }

  next(): InputCommand {
    const command = {
      sequence: ++this.sequence,
      moveX: Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")),
      moveZ: Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS")),
      aimX: this.aim.x,
      aimZ: this.aim.z,
      jump: this.jump,
      sprint: this.sprint,
      throwBall: this.throwBall,
      hook: this.hook,
    };
    this.jump = false;
    this.sprint = false;
    this.throwBall = false;
    this.hook = false;
    return command;
  }
}
