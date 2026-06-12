import type { Exhibit, ExhibitKind } from "@tinyworld/world";
import { EXHIBITS } from "@tinyworld/world";
import { Container, Graphics, Text, TextStyle } from "pixi.js";

const TILE = 16;
const INTERACT_RANGE = 26; // px — a little over 1.5 tiles

const SIGN_COLOR: Record<ExhibitKind, number> = {
  project: 0x4ecdc4,
  about: 0x6abf69,
  contact: 0xffe66d,
  meta: 0xb084f5,
};

/** In-world exhibit signs + proximity queries against the local player. */
export class ExhibitMarkers {
  readonly container: Container;
  private readonly markers: { exhibit: Exhibit; cx: number; cy: number }[] = [];

  constructor() {
    this.container = new Container();
    for (const exhibit of EXHIBITS) {
      const cx = exhibit.tileX * TILE + TILE / 2;
      const cy = exhibit.tileY * TILE + TILE / 2;
      this.markers.push({ exhibit, cx, cy });
      this.container.addChild(this.makeMarker(exhibit, cx, cy));
    }
  }

  /** The exhibit within interaction range of (x, y), or null. */
  nearest(x: number, y: number): Exhibit | null {
    let best: Exhibit | null = null;
    let bestDist = INTERACT_RANGE;
    for (const m of this.markers) {
      const d = Math.hypot(m.cx - x, m.cy - y);
      if (d <= bestDist) {
        bestDist = d;
        best = m.exhibit;
      }
    }
    return best;
  }

  private makeMarker(exhibit: Exhibit, cx: number, cy: number): Container {
    const c = new Container();
    c.x = cx;
    c.y = cy;

    const post = new Graphics();
    post.rect(-1, 0, 2, 8).fill({ color: 0x6b4a2b }); // wooden post
    post
      .roundRect(-7, -11, 14, 12, 2)
      .fill({ color: SIGN_COLOR[exhibit.kind] })
      .stroke({ color: 0x000000, width: 1 }); // sign board
    c.addChild(post);

    const label = new Text({
      text: exhibit.label,
      style: new TextStyle({
        fontSize: 6,
        fill: "#ffffff",
        stroke: { color: "#000000", width: 2 },
        align: "center",
      }),
    });
    label.anchor.set(0.5, 1);
    label.y = -13;
    c.addChild(label);

    return c;
  }
}
