import { TILES_BY_ID } from "./tiles.js";
import type { Rect, TileMapData } from "./types.js";

export class CollisionGrid {
  private readonly solid: boolean[];
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;

  constructor(map: TileMapData) {
    this.width = map.width;
    this.height = map.height;
    this.tileSize = map.tileSize;
    this.solid = new Array(map.width * map.height);

    for (let i = 0; i < this.solid.length; i++) {
      const tileId = map.layers.ground[i];
      const tile = TILES_BY_ID[tileId];
      this.solid[i] = tile?.solid ?? false;
    }
  }

  isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return true;
    return this.solid[ty * this.width + tx];
  }

  testRect(rect: Rect): boolean {
    const ts = this.tileSize;
    const x0 = Math.floor(rect.x / ts);
    const y0 = Math.floor(rect.y / ts);
    const x1 = Math.floor((rect.x + rect.width - 0.01) / ts);
    const y1 = Math.floor((rect.y + rect.height - 0.01) / ts);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isSolid(tx, ty)) return true;
      }
    }
    return false;
  }
}
