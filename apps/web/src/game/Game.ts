import { VILLAGE_MAP } from "@tinyworld/world";
import { Application } from "pixi.js";
import { Camera } from "./Camera.js";
import { CollisionGrid } from "./Collision.js";
import { createInput } from "./Input.js";
import { MapRenderer } from "./MapRenderer.js";
import { Player } from "./Player.js";

export interface GameInstance {
  app: Application;
  destroy: () => void;
}

export async function initGame(container: HTMLElement): Promise<GameInstance> {
  const app = new Application();

  await app.init({
    background: "#1a1a2e",
    resizeTo: container,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas);

  const mapRenderer = new MapRenderer(VILLAGE_MAP);
  const collision = new CollisionGrid(VILLAGE_MAP);
  const camera = new Camera(
    app.screen.width,
    app.screen.height,
    mapRenderer.widthPx,
    mapRenderer.heightPx,
  );

  const player = new Player(VILLAGE_MAP.spawn.x, VILLAGE_MAP.spawn.y);
  const input = createInput();

  camera.container.addChild(mapRenderer.container);
  camera.container.addChild(player.container);
  app.stage.addChild(camera.container);

  const onResize = () => {
    camera.resize(app.screen.width, app.screen.height);
  };
  app.renderer.on("resize", onResize);

  app.ticker.add(() => {
    const dt = app.ticker.deltaMS / 1000;
    player.update(dt, input, collision);
    camera.follow(player.x + VILLAGE_MAP.tileSize / 2, player.y + VILLAGE_MAP.tileSize / 2, dt);
  });

  return {
    app,
    destroy: () => {
      app.renderer.off("resize", onResize);
      app.destroy(true);
    },
  };
}
