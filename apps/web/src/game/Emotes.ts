import type { EmoteKind } from "@tinyworld/shared";
import { Container, Text, TextStyle } from "pixi.js";

const EMOJI: Record<EmoteKind, string> = {
  wave: "👋",
  heart: "❤️",
  question: "❓",
  bang: "❗",
};

const LIFETIME = 1.6; // seconds
const RISE = 14; // px the emote drifts up over its life

interface ActiveEmote {
  text: Text;
  getPos: () => { x: number; y: number };
  age: number;
}

/** Floating emote bubbles, world-space, anchored above whichever avatar emoted. */
export class Emotes {
  readonly container: Container;
  private readonly active: ActiveEmote[] = [];

  constructor() {
    this.container = new Container();
  }

  spawn(kind: EmoteKind, getPos: () => { x: number; y: number }): void {
    const text = new Text({ text: EMOJI[kind], style: new TextStyle({ fontSize: 16 }) });
    text.anchor.set(0.5, 1);
    this.container.addChild(text);
    this.active.push({ text, getPos, age: 0 });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.age += dt;
      if (e.age >= LIFETIME) {
        e.text.destroy();
        this.active.splice(i, 1);
        continue;
      }
      const f = e.age / LIFETIME;
      const pos = e.getPos();
      e.text.x = pos.x;
      e.text.y = pos.y - 22 - RISE * f;
      e.text.alpha = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3; // fade out over the last 30%
    }
  }
}
