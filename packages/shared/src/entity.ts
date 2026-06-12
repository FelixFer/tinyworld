import type { Dir } from "./protocol.js";

export interface Entity {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  name: string;
  lastInputSeq: number;
}

export interface EntityInput {
  entityId: string;
  seq: number;
  dt: number;
  dx: number;
  dy: number;
}

export const SPEED = 96;

export interface Steppable {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  lastInputSeq: number;
}

export function step(
  entities: Map<string, Steppable>,
  inputs: EntityInput[],
  tickDuration: number,
): void {
  for (const input of inputs) {
    const entity = entities.get(input.entityId);
    if (!entity) continue;

    const dx = input.dx;
    const dy = input.dy;

    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) > Math.abs(dy)) {
        entity.dir = dx > 0 ? "right" : "left";
      } else {
        entity.dir = dy > 0 ? "down" : "up";
      }
    }

    const moveX = dx * SPEED * input.dt;
    const moveY = dy * SPEED * input.dt;

    entity.x += moveX;
    entity.y += moveY;
    entity.lastInputSeq = input.seq;
  }
}

export function createEntity(id: string, x: number, y: number, name: string): Entity {
  return {
    id,
    x,
    y,
    dir: "down",
    name,
    lastInputSeq: 0,
  };
}
