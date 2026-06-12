import type { PingMsg, PongMsg, ServerMsg } from '@tinyworld/shared'

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3000/ws'
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

export interface SocketHandle {
  close: () => void
}

interface SocketOptions {
  onPing: (ms: number) => void
  onOpen: () => void
  onClose: () => void
}

export function createSocket(opts: SocketOptions): SocketHandle {
  const ws = new WebSocket(WS_URL)
  let pingInterval: ReturnType<typeof setInterval> | undefined

  ws.addEventListener('open', () => {
    opts.onOpen()
    pingInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      const msg: PingMsg = { type: 'ping', t: Date.now() }
      ws.send(JSON.stringify(msg))
    }, 2000)
  })

  ws.addEventListener('message', (event) => {
    let msg: ServerMsg
    try {
      msg = JSON.parse(event.data as string) as ServerMsg
    } catch {
      return
    }
    if (msg.type === 'pong') {
      opts.onPing(Date.now() - (msg as PongMsg).t)
    }
  })

  ws.addEventListener('close', () => {
    clearInterval(pingInterval)
    opts.onClose()
  })

  return {
    close: () => {
      clearInterval(pingInterval)
      ws.close()
    },
  }
}
