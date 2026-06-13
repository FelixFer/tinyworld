import type { Dir, EntityKind, EntitySnapshot } from "@tinyworld/shared";
import { Container, Graphics, Text, TextStyle } from "pixi.js";

const TILE = 16;
const BODY_SIZE = 12;
const INTERPOLATION_DELAY = 0.12;

interface SnapshotEntry {
  tick: number;
  x: number;
  y: number;
  dir: Dir;
  time: number;
}

export class RemoteEntity {
  readonly container: Container;
  readonly entityId: string;
  private name: string;
  private snapshots: SnapshotEntry[] = [];
  private animTime = 0;
  private dir: Dir = "down";
  private readonly kind: EntityKind;

  constructor(id: string, snapshot: EntitySnapshot, kind: EntityKind = "player") {
    this.entityId = id;
    this.kind = kind;
    this.name = snapshot.name;
    this.dir = snapshot.dir;
    this.container = new Container();
    this.container.x = Math.round(snapshot.x + TILE / 2);
    this.container.y = Math.round(snapshot.y + TILE / 2);
    this.addSnapshot(0, snapshot);
    this.render();
  }

  addSnapshot(tick: number, snapshot: EntitySnapshot): void {
    this.snapshots.push({
      tick,
      x: snapshot.x,
      y: snapshot.y,
      dir: snapshot.dir,
      time: performance.now() / 1000,
    });

    if (this.snapshots.length > 20) {
      this.snapshots.shift();
    }
  }

  update(serverTime: number, dt: number): void {
    const targetTime = serverTime - INTERPOLATION_DELAY;

    let prev: SnapshotEntry | null = null;
    let next: SnapshotEntry | null = null;

    for (let i = 0; i < this.snapshots.length; i++) {
      const s = this.snapshots[i];
      if (s.time <= targetTime) {
        prev = s;
      }
      if (s.time >= targetTime && !next) {
        next = s;
        break;
      }
    }

    if (prev && next && prev !== next) {
      const t = (targetTime - prev.time) / (next.time - prev.time);
      const x = prev.x + (next.x - prev.x) * t;
      const y = prev.y + (next.y - prev.y) * t;
      this.dir = t < 0.5 ? prev.dir : next.dir;

      this.container.x = Math.round(x + TILE / 2);
      this.container.y = Math.round(y + TILE / 2);
    } else if (prev) {
      this.container.x = Math.round(prev.x + TILE / 2);
      this.container.y = Math.round(prev.y + TILE / 2);
      this.dir = prev.dir;
    }

    this.animTime += dt * 8;
    this.render();
  }

  private render(): void {
    this.container.removeChildren();
    const bob = Math.sin(this.animTime) * 1.5;

    if (this.kind === "cat") {
      const cat = new Text({ text: "🐱", style: new TextStyle({ fontSize: 16 }) });
      cat.anchor.set(0.5, 0.5);
      cat.y = bob;
      this.container.addChild(cat);
      return;
    }

    if (this.kind === "dog") {
      const dog = new Text({ text: "🐶", style: new TextStyle({ fontSize: 16 }) });
      dog.anchor.set(0.5, 0.5);
      dog.y = bob;
      this.container.addChild(dog);
      return;
    }

    const body = new Graphics();
    body.roundRect(-BODY_SIZE / 2, -BODY_SIZE / 2 + bob, BODY_SIZE, BODY_SIZE, 2);
    body.fill({ color: 0xff6b9d });
    body.stroke({ color: 0xcc4477, width: 1 });

    const nameText = new Text({
      text: this.name,
      style: new TextStyle({
        fontSize: 8,
        fill: "#ffffff",
        stroke: { color: "#000000", width: 2 },
      }),
    });
    nameText.anchor.set(0.5, 1);
    nameText.x = 0;
    nameText.y = -BODY_SIZE / 2 - 2;

    this.container.addChild(body);
    this.container.addChild(nameText);
  }
}
