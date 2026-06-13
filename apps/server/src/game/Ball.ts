import type { SolidTest } from "@tinyworld/shared";
import { BALL_RADIUS, BALL_SPAWN } from "@tinyworld/shared";

const FRICTION_PER_S = 1.4; // velocity decay rate
const STOP_SPEED = 6; // below this magnitude, the ball stops
const RESTITUTION = 0.5; // energy kept on a wall bounce

/** Server-authoritative kickable ball with simple rolling physics. */
export class Ball {
  x: number = BALL_SPAWN.x;
  y: number = BALL_SPAWN.y;
  vx = 0;
  vy = 0;

  reset(): void {
    this.x = BALL_SPAWN.x;
    this.y = BALL_SPAWN.y;
    this.vx = 0;
    this.vy = 0;
  }

  /** Impart velocity in the (dirX, dirY) direction at the given speed. */
  kick(dirX: number, dirY: number, speed: number): void {
    const len = Math.hypot(dirX, dirY) || 1;
    this.vx = (dirX / len) * speed;
    this.vy = (dirY / len) * speed;
  }

  update(dt: number, isSolid: SolidTest): void {
    if (this.vx === 0 && this.vy === 0) return;

    const decay = Math.max(0, 1 - FRICTION_PER_S * dt);
    this.vx *= decay;
    this.vy *= decay;
    if (Math.hypot(this.vx, this.vy) < STOP_SPEED) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // Axis-separated movement; bounce off solid tiles.
    const nx = this.x + this.vx * dt;
    if (isSolid(this.rectAt(nx, this.y))) {
      this.vx = -this.vx * RESTITUTION;
    } else {
      this.x = nx;
    }
    const ny = this.y + this.vy * dt;
    if (isSolid(this.rectAt(this.x, ny))) {
      this.vy = -this.vy * RESTITUTION;
    } else {
      this.y = ny;
    }
  }

  private rectAt(cx: number, cy: number) {
    return {
      x: cx - BALL_RADIUS,
      y: cy - BALL_RADIUS,
      width: BALL_RADIUS * 2,
      height: BALL_RADIUS * 2,
    };
  }
}
