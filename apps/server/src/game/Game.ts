import type { Dir, EntityInput, SolidTest, Steppable } from "@tinyworld/shared";
import { createEntity, step } from "@tinyworld/shared";
import { CollisionGrid, VILLAGE_MAP } from "@tinyworld/world";

const collision = new CollisionGrid(VILLAGE_MAP);
const isSolid: SolidTest = (rect) => collision.testRect(rect);

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

      const lastInput = inputs[inputs.length - 1];

      // Collapse all inputs received this tick into a single direction.
      let totalDx = 0;
      let totalDy = 0;
      for (const input of inputs) {
        totalDx += input.dx;
        totalDy += input.dy;
      }
      const normDx = totalDx > 0 ? 1 : totalDx < 0 ? -1 : 0;
      const normDy = totalDy > 0 ? 1 : totalDy < 0 ? -1 : 0;

      // Substep at 1/60 so server collision matches the client's fixed step.
      const subDt = 1 / 60;
      const steps = Math.max(1, Math.round(this.tickDuration / subDt));
      for (let i = 0; i < steps; i++) {
        step(serverEntity, { dx: normDx, dy: normDy, dt: subDt }, isSolid);
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
