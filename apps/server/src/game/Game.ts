import type { Dir, Entity, EntityInput, Steppable } from "@tinyworld/shared";
import { createEntity, step } from "@tinyworld/shared";
import { VILLAGE_MAP } from "@tinyworld/world";

export class ServerEntity implements Steppable {
  readonly id: string;
  x: number;
  y: number;
  dir: Dir;
  name: string;
  lastInputSeq: number;
  private pendingInputs: EntityInput[] = [];

  constructor(id: string, x: number, y: number, name: string) {
    const entity = createEntity(id, x, y, name);
    this.id = entity.id;
    this.x = entity.x;
    this.y = entity.y;
    this.dir = entity.dir;
    this.name = entity.name;
    this.lastInputSeq = entity.lastInputSeq;
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

    const allInputs: EntityInput[] = [];
    for (const serverEntity of this.entities.values()) {
      const inputs = serverEntity.getPendingInputs();
      allInputs.push(...inputs);
    }

    step(this.entities, allInputs, this.tickDuration);
  }

  addEntity(id: string, x: number, y: number, name: string): ServerEntity {
    const entity = new ServerEntity(id, x, y, name);
    this.entities.set(id, entity);
    return entity;
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
  }

  getEntity(id: string): ServerEntity | undefined {
    return this.entities.get(id);
  }
}
