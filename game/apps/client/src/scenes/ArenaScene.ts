import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  LoadAssetContainerAsync,
  ImportMeshAsync,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
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
  private babyAssets?: Awaited<ReturnType<typeof LoadAssetContainerAsync>>;
  private babyAssetsReady: Promise<void>;

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
    this.buildPickingSurface();
    this.babyAssetsReady = this.loadBabyAssets();
    void this.loadArenaAssets();
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

  private buildPickingSurface(): void {
    const groundCoral = MeshBuilder.CreateBox(
      "ground-coral",
      { width: 36, height: 0.7, depth: 25 },
      this.scene,
    );
    groundCoral.position.set(0, -0.35, -15.5);
    groundCoral.visibility = 0;
    const groundTeal = groundCoral.clone("ground-teal")!;
    groundTeal.position.z = 15.5;
  }

  private async loadArenaAssets(): Promise<void> {
    const [visual, collision] = await Promise.all([
      ImportMeshAsync(
        "/assets/models/baby_warz_vertical_slice_2_visual.glb",
        this.scene,
      ),
      ImportMeshAsync(
        "/assets/models/baby_warz_vertical_slice_2_collision.glb",
        this.scene,
      ),
    ]);
    for (const mesh of visual.meshes) mesh.isPickable = false;
    for (const node of collision.transformNodes) node.setEnabled(false);
    for (const mesh of collision.meshes) {
      mesh.isPickable = false;
      mesh.setEnabled(false);
    }
  }

  private async loadBabyAssets(): Promise<void> {
    this.babyAssets = await LoadAssetContainerAsync(
      "/assets/models/baby_warz_production_candidate.glb",
      this.scene,
    );
  }

  private createBaby(id: string, team: "coral" | "teal"): TransformNode {
    const root = new TransformNode(id, this.scene);
    this.entities.set(id, root);
    void this.babyAssetsReady.then(() => {
      if (root.isDisposed() || !this.babyAssets) return;
      const instance = this.babyAssets.instantiateModelsToScene(
        (name) => `${id}-${name}`,
        true,
      );
      for (const node of instance.rootNodes) node.parent = root;
      for (const node of root.getChildTransformNodes(false))
        if (node.name.includes("COL_")) node.setEnabled(false);
      for (const animation of instance.animationGroups) {
        if (animation.name.includes("ANIM_Idle")) animation.start(true);
      }
      root.metadata = { team };
    });
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
