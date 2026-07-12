import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import {
  BALL_SPAWNS,
  FOOD_SPAWNS,
  TUNING,
  foodModifiers,
  type WorldSnapshot,
} from "@baby-warz/shared";

const COLORS = {
  cream: "#fff4e3",
  sand: "#d9b77a",
  coral: "#ef6654",
  teal: "#26a7a4",
  indigo: "#173a6d",
  cyan: "#43d6e8",
  gold: "#f2b134",
  charcoal: "#35343a",
  skin: "#f3b07d",
};

export class ArenaScene {
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private readonly entities = new Map<string, TransformNode>();
  private readonly materials = new Map<string, StandardMaterial>();
  private hookMeshes: Mesh[] = [];

  constructor(
    engine: Engine,
    private readonly localId: () => string | undefined,
    private readonly isSpectator: () => boolean,
  ) {
    this.scene = new Scene(engine);
    this.scene.clearColor = Color4.FromHexString("#0f2448ff");
    this.camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      0.92,
      39,
      Vector3.Zero(),
      this.scene,
    );
    this.camera.lowerRadiusLimit = 20;
    this.camera.upperRadiusLimit = 56;
    this.camera.lowerBetaLimit = 0.65;
    this.camera.upperBetaLimit = 1.15;
    new HemisphericLight("sky", new Vector3(0, 1, 0), this.scene).intensity =
      1.5;
    const key = new DirectionalLight(
      "key",
      new Vector3(-0.4, -1, 0.35),
      this.scene,
    );
    key.intensity = 1.1;
    this.buildArena();
  }

  enableSpectatorControls(canvas: HTMLCanvasElement): void {
    if (this.isSpectator()) {
      this.camera.attachControl(canvas, true);
      const pointers = this.camera.inputs.attached.pointers as unknown as {
        buttons: number[];
      };
      pointers.buttons = [2];
    } else this.camera.detachControl();
  }

  update(snapshot: WorldSnapshot): void {
    const seen = new Set<string>();
    for (const player of snapshot.players.filter(
      (value) => value.role === "player",
    )) {
      const node =
        this.entities.get(player.id) ??
        this.createBaby(player.id, player.team ?? "coral");
      node.setEnabled(!player.eliminated);
      const targetPosition = new Vector3(
        player.position.x,
        player.position.y,
        player.position.z,
      );
      node.position.copyFrom(
        Vector3.Lerp(
          node.position,
          targetPosition,
          player.id === this.localId() ? 0.72 : 0.4,
        ),
      );
      node.rotation.y = player.facing;
      const modifiers = foodModifiers(player.foods);
      node.scaling.setAll(modifiers.scale);
      const diaper = node
        .getChildTransformNodes(false)
        .find((value) => value.name.endsWith("-diaper"));
      if (diaper) {
        diaper.scaling.x = 1 + player.foods.length * 0.12;
        diaper.scaling.z = 1 + player.foods.length * 0.16;
      }
      seen.add(player.id);
      if (player.id === this.localId() && !this.isSpectator())
        this.camera.target = Vector3.Lerp(
          this.camera.target,
          node.position,
          0.12,
        );
    }
    for (const ball of snapshot.balls) {
      const id = `mesh-${ball.id}`;
      const node = this.entities.get(id) ?? this.createBall(id);
      node.position.set(ball.position.x, ball.position.y, ball.position.z);
      seen.add(id);
    }
    for (const food of snapshot.foods) {
      const id = `mesh-${food.id}`;
      const node = this.entities.get(id) ?? this.createFood(id, food.food);
      node.setEnabled(food.available);
      node.position.set(food.position.x, food.position.y, food.position.z);
      node.rotation.y += 0.02;
      seen.add(id);
    }
    for (const [id, node] of this.entities)
      if (!seen.has(id)) {
        node.dispose();
        this.entities.delete(id);
      }
    for (const mesh of this.hookMeshes) mesh.dispose();
    this.hookMeshes = [];
    for (const hook of snapshot.hooks) {
      const owner = snapshot.players.find((value) => value.id === hook.ownerId);
      if (!owner) continue;
      const line = MeshBuilder.CreateLines(
        `hook-${hook.ownerId}`,
        {
          points: [
            new Vector3(
              owner.position.x,
              owner.position.y + 0.4,
              owner.position.z,
            ),
            new Vector3(hook.end.x, hook.end.y, hook.end.z),
          ],
          updatable: false,
        },
        this.scene,
      );
      line.color = Color3.FromHexString(COLORS.cyan);
      this.hookMeshes.push(line);
    }
  }

  setAimFromPointer(
    x: number,
    y: number,
    playerPosition: { x: number; z: number } | undefined,
  ): { x: number; z: number } | undefined {
    if (!playerPosition) return undefined;
    const pick = this.scene.pick(x, y, (mesh) =>
      mesh.name.startsWith("ground"),
    );
    if (!pick?.pickedPoint) return undefined;
    const dx = pick.pickedPoint.x - playerPosition.x,
      dz = pick.pickedPoint.z - playerPosition.z;
    const length = Math.hypot(dx, dz);
    return length > 0.01 ? { x: dx / length, z: dz / length } : undefined;
  }

  private buildArena(): void {
    const groundCoral = MeshBuilder.CreateBox(
      "ground-coral",
      { width: 36, height: 0.7, depth: 25 },
      this.scene,
    );
    groundCoral.position.set(0, -0.35, -15.5);
    groundCoral.material = this.material("ground-coral", COLORS.sand);
    const groundTeal = groundCoral.clone("ground-teal")!;
    groundTeal.position.z = 15.5;
    for (const [team, z, color] of [
      ["coral", -2.8, COLORS.coral],
      ["teal", 2.8, COLORS.teal],
    ] as const) {
      const trim = MeshBuilder.CreateBox(
        `trim-${team}`,
        { width: 36, height: 0.18, depth: 0.55 },
        this.scene,
      );
      trim.position.set(0, 0.1, z);
      trim.material = this.material(`team-${team}`, color);
    }
    const river = MeshBuilder.CreateBox(
      "river",
      { width: 36, height: 0.35, depth: TUNING.riverHalfWidth * 2 },
      this.scene,
    );
    river.position.y = -0.75;
    river.material = this.material("river", COLORS.indigo, 0.35);
    for (const z of [-TUNING.riverHalfWidth, TUNING.riverHalfWidth]) {
      const edge = MeshBuilder.CreateBox(
        `river-edge-${z}`,
        { width: 36, height: 0.12, depth: 0.18 },
        this.scene,
      );
      edge.position.set(0, -0.22, z);
      edge.material = this.material("cyan", COLORS.cyan, 0.3);
    }
    for (const x of [-12, -4, 4, 12])
      for (const z of [-10, 10]) {
        const cover = MeshBuilder.CreateBox(
          `cover-${x}-${z}`,
          { width: 3.2, height: 1.5, depth: 2.1 },
          this.scene,
        );
        cover.position.set(x, 0.75, z);
        cover.rotation.y = x * 0.03;
        cover.material = this.material("cover", COLORS.cream);
      }
    for (const team of ["coral", "teal"] as const)
      for (const spawn of BALL_SPAWNS[team]) {
        const pad = MeshBuilder.CreateCylinder(
          `ball-pad-${team}`,
          { diameter: 1.4, height: 0.12 },
          this.scene,
        );
        pad.position.set(spawn.x, 0.05, spawn.z);
        pad.material = this.material(`team-${team}`, COLORS[team]);
      }
    for (const team of ["coral", "teal"] as const)
      for (const spawn of FOOD_SPAWNS[team]) {
        const pad = MeshBuilder.CreateCylinder(
          `food-pad-${team}`,
          { diameter: 1.6, height: 0.16 },
          this.scene,
        );
        pad.position.set(spawn.x, 0.08, spawn.z);
        pad.material = this.material("gold", COLORS.gold);
      }
  }

  private createBaby(id: string, team: "coral" | "teal"): TransformNode {
    const root = new TransformNode(id, this.scene);
    this.entities.set(id, root);
    const body = MeshBuilder.CreateSphere(
      `${id}-body`,
      { diameterX: 1.65, diameterY: 1.95, diameterZ: 1.4, segments: 12 },
      this.scene,
    );
    body.position.y = 0.15;
    body.parent = root;
    body.material = this.material("skin", COLORS.skin);
    const head = MeshBuilder.CreateSphere(
      `${id}-head`,
      { diameter: 1.55, segments: 12 },
      this.scene,
    );
    head.position.y = 1.35;
    head.parent = root;
    head.material = this.material("skin", COLORS.skin);
    const bib = MeshBuilder.CreateSphere(
      `${id}-bib`,
      {
        diameterX: 1.4,
        diameterY: 0.75,
        diameterZ: 1.48,
        segments: 10,
        slice: 0.55,
      },
      this.scene,
    );
    bib.position.set(0, 0.55, 0.08);
    bib.parent = root;
    bib.material = this.material(`team-${team}`, COLORS[team]);
    const diaper = MeshBuilder.CreateSphere(
      `${id}-diaper`,
      { diameterX: 1.8, diameterY: 1.15, diameterZ: 1.65, segments: 10 },
      this.scene,
    );
    diaper.position.y = -0.55;
    diaper.parent = root;
    diaper.material = this.material("diaper", COLORS.cream);
    for (const side of [-1, 1]) {
      const hand = MeshBuilder.CreateSphere(
        `${id}-${side < 0 ? "left-hook" : "right-ball"}-hand`,
        { diameter: 0.48, segments: 8 },
        this.scene,
      );
      hand.position.set(side * 1.05, 0.2, 0.05);
      hand.parent = root;
      hand.material = this.material("skin", COLORS.skin);
      const band = MeshBuilder.CreateTorus(
        `${id}-band-${side}`,
        { diameter: 0.5, thickness: 0.12, tessellation: 10 },
        this.scene,
      );
      band.position.set(side * 0.86, 0.2, 0.05);
      band.rotation.z = Math.PI / 2;
      band.parent = root;
      band.material = this.material(`team-${team}`, COLORS[team]);
    }
    return root;
  }

  private createBall(id: string): TransformNode {
    const ball = MeshBuilder.CreateSphere(
      id,
      { diameter: 0.78, segments: 12 },
      this.scene,
    );
    ball.material = this.material("ball", "#e94f37", 0.15);
    this.entities.set(id, ball);
    return ball;
  }
  private createFood(id: string, food: string): TransformNode {
    const root = new TransformNode(id, this.scene);
    const pickup = MeshBuilder.CreatePolyhedron(
      `${id}-${food}`,
      { type: 2, size: 0.65 },
      this.scene,
    );
    pickup.parent = root;
    pickup.material = this.material(`food-${food}`, COLORS.gold);
    this.entities.set(id, root);
    return root;
  }
  private material(id: string, color: string, metallic = 0): StandardMaterial {
    const cached = this.materials.get(id);
    if (cached) return cached;
    const material = new StandardMaterial(id, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = new Color3(metallic, metallic, metallic);
    this.materials.set(id, material);
    return material;
  }
}
