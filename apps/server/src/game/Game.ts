import type { Dir, EntityInput, Steppable } from "@tinyworld/shared";
import { SPEED, createEntity, step } from "@tinyworld/shared";
import { CollisionGrid, VILLAGE_MAP } from "@tinyworld/world";

const HITBOX = { x: 3, y: 8, width: 10, height: 8 };

const collision = new CollisionGrid(VILLAGE_MAP);

function tryMove(entity: Steppable, dx: number, dy: number, dt: number): void {
  const moveX = dx * SPEED * dt;
  const moveY = dy * SPEED * dt;

  if (moveX !== 0) {
    const newX = entity.x + moveX;
    if (
      !collision.testRect({
        x: newX + HITBOX.x,
        y: entity.y + HITBOX.y,
        width: HITBOX.width,
        height: HITBOX.height,
      })
    ) {
      entity.x = newX;
    }
  }

  if (moveY !== 0) {
    const newY = entity.y + moveY;
    if (
      !collision.testRect({
        x: entity.x + HITBOX.x,
        y: newY + HITBOX.y,
        width: HITBOX.width,
        height: HITBOX.height,
      })
    ) {
      entity.y = newY;
    }
  }
}

export class ServerEntity implements Steppable {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  name: string;
  lastInputSeq: number;
  token: string;
  disconnectedAt = 0;
  private pendingInputs: EntityInput[] = [];

  constructor(id: string, x: number, y: number, name: string, token: string) {
    const entity = createEntity(id, x, y, name);
    this.id = entity.id;
    this.x = entity.x;
    this.y = entity.y;
    this.dir = entity.dir;
    this.name = entity.name;
    this.lastInputSeq = entity.lastInputSeq;
    this.token = token;
  }

  queueInput(input: EntityInput): void {
    this.pendingInputs.push(input);
  }

  getPendingInputs(): EntityInput[] {
    const inputs = this.pendingInputs;
    this.pendingInputs = [];
    return inputs;
  }
}

export class ServerGame {
  readonly entities = new Map<string, ServerEntity>();
  currentTick = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private readonly tickRate = 20;
  private readonly tickDuration = 1 / 20;

  start(): void {
    this.tickInterval = setInterval(() => this.gameTick(), 1000 / this.tickRate);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private gameTick(): void {
    this.currentTick++;

    for (const serverEntity of this.entities.values()) {
      const inputs = serverEntity.getPendingInputs();
      if (inputs.length === 0) continue;

      // Use last input's direction for facing
      const lastInput = inputs[inputs.length - 1];

      // Normalize direction from all inputs
      let totalDx = 0;
      let totalDy = 0;
      for (const input of inputs) {
        totalDx += input.dx;
        totalDy += input.dy;
      }
      const normDx = totalDx > 0 ? 1 : totalDx < 0 ? -1 : 0;
      const normDy = totalDy > 0 ? 1 : totalDy < 0 ? -1 : 0;

      if (normDx !== 0 || normDy !== 0) {
        if (Math.abs(normDx) > Math.abs(normDy)) {
          serverEntity.dir = normDx > 0 ? "right" : "left";
        } else {
          serverEntity.dir = normDy > 0 ? "down" : "up";
        }
      }

      // Substep at 1/60 granularity to match client collision accuracy
      const subDt = 1 / 60;
      const steps = Math.max(1, Math.round(this.tickDuration / subDt));
      for (let i = 0; i < steps; i++) {
        tryMove(serverEntity, normDx, normDy, subDt);
      }

      serverEntity.lastInputSeq = lastInput.seq;
    }
  }

  addEntity(id: string, x: number, y: number, name: string, token: string): ServerEntity {
    const entity = new ServerEntity(id, x, y, name, token);
    this.entities.set(id, entity);
    return entity;
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
  }

  findEntityByToken(token: string): ServerEntity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.token === token) return entity;
    }
    return undefined;
  }

  reconnectEntity(entity: ServerEntity, newId: string): void {
    this.entities.delete(entity.id);
    entity.id = newId;
    entity.disconnectedAt = 0;
    this.entities.set(newId, entity);
  }

  markDisconnected(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.disconnectedAt = Date.now();
    }
  }

  cleanupDisconnected(graceMs: number): void {
    const now = Date.now();
    for (const [id, entity] of this.entities) {
      if (entity.disconnectedAt > 0 && now - entity.disconnectedAt >= graceMs) {
        this.entities.delete(id);
      }
    }
  }

  getEntity(id: string): ServerEntity | undefined {
    return this.entities.get(id);
  }
}
