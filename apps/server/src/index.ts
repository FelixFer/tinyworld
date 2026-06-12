import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import uWS from 'uWebSockets.js'
import type { PingMsg, ServerMsg } from '@tinyworld/shared'

const PORT = Number(process.env.PORT) || 3000
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', '..', '..', 'public')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

const app = uWS.App()

app
  .get('/healthz', (res) => {
    res.writeHeader('Content-Type', 'application/json').end(JSON.stringify({ ok: true }))
  })
  .ws('/ws', {
    compression: 0,
    maxPayloadLength: 16 * 1024,
    idleTimeout: 60,

    open(_ws) {
      console.log('client connected')
    },

    message(ws, message) {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(Buffer.from(message).toString())
      } catch {
        return
      }
      if (msg.type === 'ping') {
        const pong: ServerMsg = {
          type: 'pong',
          t: (msg as unknown as PingMsg).t,
          serverTime: Date.now(),
        }
        ws.send(JSON.stringify(pong), false)
      }
    },

    close(_ws) {
      console.log('client disconnected')
    },
  })
  .get('/*', (res, req) => {
    const url = req.getUrl()
    const rel = url === '/' ? 'index.html' : url.slice(1)
    const filePath = join(PUBLIC_DIR, rel)
    const ext = filePath.slice(filePath.lastIndexOf('.'))
    try {
      const data = readFileSync(filePath)
      res.writeHeader('Content-Type', MIME[ext] ?? 'application/octet-stream').end(data)
    } catch {
      // SPA fallback
      try {
        const data = readFileSync(join(PUBLIC_DIR, 'index.html'))
        res.writeHeader('Content-Type', 'text/html; charset=utf-8').end(data)
      } catch {
        res.writeStatus('404 Not Found').end('Not found')
      }
    }
  })
  .listen(PORT, (token) => {
    if (token) {
      console.log(`tinyworld listening on :${PORT}`)
    } else {
      console.error(`Failed to listen on :${PORT}`)
      process.exit(1)
    }
  })
