import { Container } from "pixi.js";

const LERP_FACTOR = 5;

export class Camera {
  readonly container: Container;
  private targetX = 0;
  private targetY = 0;
  private viewWidth = 0;
  private viewHeight = 0;
  private worldWidth = 0;
  private worldHeight = 0;

  constructor(viewWidth: number, viewHeight: number, worldWidth: number, worldHeight: number) {
    this.container = new Container();
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  follow(x: number, y: number, dt: number): void {
    this.targetX = x;
    this.targetY = y;

    const t = 1 - Math.exp(-LERP_FACTOR * dt);
    const currentX = -this.container.x + this.viewWidth / 2;
    const currentY = -this.container.y + this.viewHeight / 2;

    let newX = currentX + (this.targetX - currentX) * t;
    let newY = currentY + (this.targetY - currentY) * t;

    newX = Math.max(0, Math.min(newX, this.worldWidth - this.viewWidth));
    newY = Math.max(0, Math.min(newY, this.worldHeight - this.viewHeight));

    if (this.worldWidth <= this.viewWidth) newX = (this.worldWidth - this.viewWidth) / 2;
    if (this.worldHeight <= this.viewHeight) newY = (this.worldHeight - this.viewHeight) / 2;

    this.container.x = Math.round(-newX);
    this.container.y = Math.round(-newY);
  }
}
