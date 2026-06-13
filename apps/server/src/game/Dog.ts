import type { Dir, SolidTest } from "@tinyworld/shared";

const DOG_SPEED = 34; // px/s — dogs mosey
const DOG_HITBOX = { x: 3, y: 6, width: 10, height: 8 };
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** A server-authoritative NPC dog that wanders the map on its own. */
export class Dog {
  x: number;
  y: number;
  dir: Dir = "down";
  private dx = 0;
  private dy = 0;
  private timer = 0; // seconds until the next decision
  private walking = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number, isSolid: SolidTest): void {
    this.timer -= dt;
    if (this.timer <= 0) this.decide();

    if (this.walking && !this.tryMove(dt, isSolid)) {
      // Bumped into something — pick a new plan next.
      this.decide();
    }
  }

  private decide(): void {
    if (Math.random() < 0.35) {
      this.walking = false;
      this.dx = 0;
      this.dy = 0;
      this.timer = 1 + Math.random() * 2; // sit for 1–3s
      return;
    }
    this.walking = true;
    const [dx, dy] = DIRS[Math.floor(Math.random() * DIRS.length)];
    this.dx = dx;
    this.dy = dy;
    this.dir = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
    this.timer = 1.5 + Math.random() * 2.5; // amble for 1.5–4s
  }

  private tryMove(dt: number, isSolid: SolidTest): boolean {
    const { width, height, x: hx, y: hy } = DOG_HITBOX;
    let moved = false;
    const mx = this.dx * DOG_SPEED * dt;
    const my = this.dy * DOG_SPEED * dt;
    if (mx !== 0) {
      const nx = this.x + mx;
      if (!isSolid({ x: nx + hx, y: this.y + hy, width, height })) {
        this.x = nx;
        moved = true;
      }
    }
    if (my !== 0) {
      const ny = this.y + my;
      if (!isSolid({ x: this.x + hx, y: ny + hy, width, height })) {
        this.y = ny;
        moved = true;
      }
    }
    return moved;
  }
}
