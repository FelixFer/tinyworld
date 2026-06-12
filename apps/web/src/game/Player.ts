import type { Rect } from "@tinyworld/world";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { CollisionGrid } from "./Collision.js";
import type { InputState } from "./Input.js";

const SPEED = 96;
const TILE = 16;
const HITBOX = { x: 3, y: 8, width: 10, height: 8 };
const BODY_SIZE = 12;

export class Player {
  readonly container: Container;
  x: number;
  y: number;
  dir: "up" | "down" | "left" | "right" = "down";
  moving = false;
  private animTime = 0;

  constructor(spawnX: number, spawnY: number) {
    this.x = spawnX;
    this.y = spawnY;
    this.container = new Container();
    this.container.x = spawnX;
    this.container.y = spawnY;
  }

  update(dt: number, input: InputState, collision: CollisionGrid): void {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    this.moving = dx !== 0 || dy !== 0;

    if (this.moving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.dir = dx > 0 ? "right" : "left";
      } else {
        this.dir = dy > 0 ? "down" : "up";
      }
    }

    const vel = SPEED * dt;
    const moveX = dx * vel;
    const moveY = dy * vel;

    if (moveX !== 0) {
      const newX = this.x + moveX;
      const rect: Rect = {
        x: newX + HITBOX.x,
        y: this.y + HITBOX.y,
        width: HITBOX.width,
        height: HITBOX.height,
      };
      if (!collision.testRect(rect)) {
        this.x = newX;
      }
    }

    if (moveY !== 0) {
      const newY = this.y + moveY;
      const rect: Rect = {
        x: this.x + HITBOX.x,
        y: newY + HITBOX.y,
        width: HITBOX.width,
        height: HITBOX.height,
      };
      if (!collision.testRect(rect)) {
        this.y = newY;
      }
    }

    if (this.moving) {
      this.animTime += dt * 8;
    } else {
      this.animTime = 0;
    }

    this.render();
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

    this.container.addChild(body);
    this.container.addChild(arrow);
    this.container.x = Math.round(this.x + TILE / 2);
    this.container.y = Math.round(this.y + TILE / 2);
  }
}
