import { Application, Graphics } from 'pixi.js'

export interface GameInstance {
  app: Application
  destroy: () => void
}

export async function initGame(container: HTMLElement): Promise<GameInstance> {
  const app = new Application()

  await app.init({
    background: '#1a1a2e',
    resizeTo: container,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  container.appendChild(app.canvas)

  const avatar = new Graphics()
  avatar.rect(0, 0, 32, 32)
  avatar.fill({ color: 0x4ecdc4 })
  avatar.pivot.set(16, 16)
  avatar.x = app.screen.width / 2
  avatar.y = app.screen.height / 2
  app.stage.addChild(avatar)

  const onResize = () => {
    avatar.x = app.screen.width / 2
    avatar.y = app.screen.height / 2
  }
  app.renderer.on('resize', onResize)

  return {
    app,
    destroy: () => {
      app.renderer.off('resize', onResize)
      app.destroy(true)
    },
  }
}
