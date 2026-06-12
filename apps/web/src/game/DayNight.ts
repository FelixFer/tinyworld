import { DAY_CYCLE_MS } from "@tinyworld/shared";
import { Container, Graphics } from "pixi.js";

interface Keyframe {
  t: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

// Screen-space tint across one cycle. t in [0,1): 0 = midnight, 0.5 = noon.
const KEYFRAMES: Keyframe[] = [
  { t: 0.0, r: 8, g: 10, b: 40, a: 0.55 }, // midnight
  { t: 0.22, r: 20, g: 22, b: 55, a: 0.45 }, // pre-dawn
  { t: 0.28, r: 255, g: 150, b: 80, a: 0.22 }, // sunrise (warm)
  { t: 0.36, r: 255, g: 255, b: 255, a: 0.0 }, // morning — clear
  { t: 0.64, r: 255, g: 255, b: 255, a: 0.0 }, // afternoon — clear
  { t: 0.74, r: 255, g: 120, b: 50, a: 0.26 }, // sunset (warm)
  { t: 0.84, r: 35, g: 28, b: 65, a: 0.42 }, // dusk
  { t: 1.0, r: 8, g: 10, b: 40, a: 0.55 }, // midnight (wrap)
];

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

function tintAt(t: number): { color: number; alpha: number } {
  let k0 = KEYFRAMES[0];
  let k1 = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (t >= KEYFRAMES[i].t && t <= KEYFRAMES[i + 1].t) {
      k0 = KEYFRAMES[i];
      k1 = KEYFRAMES[i + 1];
      break;
    }
  }
  const f = (t - k0.t) / (k1.t - k0.t || 1);
  const r = Math.round(lerp(k0.r, k1.r, f));
  const g = Math.round(lerp(k0.g, k1.g, f));
  const b = Math.round(lerp(k0.b, k1.b, f));
  return { color: (r << 16) | (g << 8) | b, alpha: lerp(k0.a, k1.a, f) };
}

/** Full-screen day/night tint, synced to the server clock and interpolated locally. */
export class DayNight {
  readonly container: Container;
  private readonly overlay: Graphics;
  private timeOfDay: number;
  private width = 0;
  private height = 0;

  constructor() {
    this.container = new Container();
    this.overlay = new Graphics();
    this.container.addChild(this.overlay);
    // Local guess until the first snapshot corrects it (server uses the same clock).
    this.timeOfDay = (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  }

  /** Resync to the authoritative server time-of-day. */
  sync(timeOfDay: number): void {
    this.timeOfDay = timeOfDay;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  update(dt: number): void {
    this.timeOfDay = (this.timeOfDay + (dt * 1000) / DAY_CYCLE_MS) % 1;
    const { color, alpha } = tintAt(this.timeOfDay);
    this.overlay.clear();
    if (alpha > 0.001 && this.width > 0) {
      this.overlay.rect(0, 0, this.width, this.height).fill({ color, alpha });
    }
  }
}
