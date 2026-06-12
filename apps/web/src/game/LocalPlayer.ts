import type { Dir, EntitySnapshot } from "@tinyworld/shared";
import { SPEED, createEntity, step } from "@tinyworld/shared";
import type { Rect } from "@tinyworld/world";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { CollisionGrid } from "./Collision.js";
import type { InputState } from "./Input.js";

const TILE = 16;
const HITBOX = { x: 3, y: 8, width: 10, height: 8 };
const BODY_SIZE = 12;
const INPUT_RATE = 30;
const INPUT_INTERVAL = 1 / INPUT_RATE;
const FIXED_DT = 1 / 60; // Fixed timestep for movement (60Hz)

export class LocalPlayer {
  readonly container: Container;
  readonly entityId: string;
  private entity: {
    id: string;
    x: number;
    y: number;
    dir: Dir;
    name: string;
    lastInputSeq: number;
  };
  private inputSeq = 0;
  private lastInputTime = 0;
  private pendingInputs: { seq: number; dt: number; dx: number; dy: number }[] = [];
  private animTime = 0;
  private moving = false;
  private accumulator = 0;
  dir: Dir = "down";

  constructor(id: string, x: number, y: number, name: string) {
    this.entityId = id;
    this.entity = createEntity(id, x, y, name);
    this.container = new Container();
    this.container.x = Math.round(x + TILE / 2);
    this.container.y = Math.round(y + TILE / 2);
    this.render();
  }

  update(
    dt: number,
    input: InputState,
    collision: CollisionGrid,
    sendInput: (seq: number, dt: number, dx: number, dy: number) => void,
  ): void {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    this.moving = dx !== 0 || dy !== 0;

    if (this.moving) {
      if (dx !== 0 && dy !== 0) {
        this.dir = dx > 0 ? "right" : "left";
      } else if (Math.abs(dx) > Math.abs(dy)) {
        this.dir = dx > 0 ? "right" : "left";
      } else {
        this.dir = dy > 0 ? "down" : "up";
      }
    }

    const now = performance.now() / 1000;
    if (now - this.lastInputTime >= INPUT_INTERVAL) {
      this.inputSeq++;
      this.pendingInputs.push({ seq: this.inputSeq, dt: INPUT_INTERVAL, dx, dy });
      sendInput(this.inputSeq, INPUT_INTERVAL, dx, dy);
      this.lastInputTime = now;
    }

    // Fixed timestep accumulator — movement speed is independent of frame rate
    this.accumulator += dt;
    const stepDt = FIXED_DT;
    const stepDist = SPEED * stepDt;

    while (this.accumulator >= stepDt) {
      this.accumulator -= stepDt;

      const moveX = dx * stepDist;
      const moveY = dy * stepDist;

      if (moveX !== 0) {
        const newX = this.entity.x + moveX;
        const rect: Rect = {
          x: newX + HITBOX.x,
          y: this.entity.y + HITBOX.y,
          width: HITBOX.width,
          height: HITBOX.height,
        };
        if (!collision.testRect(rect)) {
          this.entity.x = newX;
        }
      }

      if (moveY !== 0) {
        const newY = this.entity.y + moveY;
        const rect: Rect = {
          x: this.entity.x + HITBOX.x,
          y: newY + HITBOX.y,
          width: HITBOX.width,
          height: HITBOX.height,
        };
        if (!collision.testRect(rect)) {
          this.entity.y = newY;
        }
      }
    }

    if (this.moving) {
      this.animTime += dt * 8;
    } else {
      this.animTime = 0;
    }

    this.render();
  }

  reconcile(snapshot: EntitySnapshot): void {
    this.entity.dir = snapshot.dir;

    // Only correct position when not actively moving (avoids jitter during gameplay)
    if (!this.moving) {
      const dx = snapshot.x - this.entity.x;
      const dy = snapshot.y - this.entity.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 20) {
        // Large discrepancy — snap to server position
        this.entity.x = snapshot.x;
        this.entity.y = snapshot.y;
      } else if (dist > 2) {
        // Small drift — gently nudge toward server position
        this.entity.x += dx * 0.1;
        this.entity.y += dy * 0.1;
      }
    }

    this.render();
  }

  getEntity() {
    return this.entity;
  }

  private render(): void {
    this.container.removeChildren();

    const body = new Graphics();
    const bob = this.moving ? Math.sin(this.animTime) * 1.5 : 0;

    body.roundRect(-BODY_SIZE / 2, -BODY_SIZE / 2 + bob, BODY_SIZE, BODY_SIZE, 2);
    body.fill({ color: 0x4ecdc4 });
    body.stroke({ color: 0x2d9a93, width: 1 });

    const arrowSize = 3;
    const arrow = new Graphics();
    switch (this.dir) {
      case "up":
        arrow.moveTo(0, -BODY_SIZE / 2 - 2 + bob);
        arrow.lineTo(-arrowSize, -BODY_SIZE / 2 + 1 + bob);
        arrow.lineTo(arrowSize, -BODY_SIZE / 2 + 1 + bob);
        arrow.closePath();
        break;
      case "down":
        arrow.moveTo(0, BODY_SIZE / 2 + 2 + bob);
        arrow.lineTo(-arrowSize, BODY_SIZE / 2 - 1 + bob);
        arrow.lineTo(arrowSize, BODY_SIZE / 2 - 1 + bob);
        arrow.closePath();
        break;
      case "left":
        arrow.moveTo(-BODY_SIZE / 2 - 2, bob);
        arrow.lineTo(-BODY_SIZE / 2 + 1, -arrowSize + bob);
        arrow.lineTo(-BODY_SIZE / 2 + 1, arrowSize + bob);
        arrow.closePath();
        break;
      case "right":
        arrow.moveTo(BODY_SIZE / 2 + 2, bob);
        arrow.lineTo(BODY_SIZE / 2 - 1, -arrowSize + bob);
        arrow.lineTo(BODY_SIZE / 2 - 1, arrowSize + bob);
        arrow.closePath();
        break;
    }
    arrow.fill({ color: 0xffe66d });

    const nameText = new Text({
      text: this.entity.name,
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
    this.container.addChild(arrow);
    this.container.addChild(nameText);
    this.container.x = Math.round(this.entity.x + TILE / 2);
    this.container.y = Math.round(this.entity.y + TILE / 2);
  }
}
