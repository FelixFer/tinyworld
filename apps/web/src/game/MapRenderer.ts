import type { TileMapData } from "@tinyworld/world";
import { TILES_BY_ID } from "@tinyworld/world";
import { Container, Graphics } from "pixi.js";

export class MapRenderer {
  readonly container: Container;
  widthPx: number;
  heightPx: number;

  constructor(map: TileMapData) {
    this.container = new Container();
    this.widthPx = map.width * map.tileSize;
    this.heightPx = map.height * map.tileSize;
    this.renderGround(map);
  }

  private renderGround(map: TileMapData): void {
    const g = new Graphics();
    const { tileSize } = map;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tileId = map.layers.ground[y * map.width + x];
        const tile = TILES_BY_ID[tileId];
        if (!tile || tile.id === 0) continue;

        g.rect(x * tileSize, y * tileSize, tileSize, tileSize);
        g.fill({ color: tile.color });
      }
    }

    this.container.addChild(g);
  }
}
