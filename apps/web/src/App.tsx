import { useEffect, useRef, useState } from 'react'
import { initGame } from './game/Game.js'
import { createSocket } from './net/socket.js'

type ConnStatus = 'connecting' | 'connected' | 'disconnected'

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ping, setPing] = useState<number | null>(null)
  const [status, setStatus] = useState<ConnStatus>('connecting')

  useEffect(() => {
    if (!containerRef.current) return
    let cleanup: (() => void) | undefined

    ;(async () => {
      const game = await initGame(containerRef.current!)
      const socket = createSocket({
        onPing: (ms) => setPing(ms),
        onOpen: () => setStatus('connected'),
        onClose: () => setStatus('disconnected'),
      })
      cleanup = () => {
        socket.close()
        game.destroy()
      }
    })().catch(console.error)

    return () => cleanup?.()
  }, [])

  const label =
    status === 'connected' && ping !== null
      ? `ping: ${ping} ms`
      : status === 'connecting'
        ? 'connecting…'
        : 'disconnected'

  return (
    <div style={{ position: 'relative', width: '100dvw', height: '100dvh' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          color: '#a8e6cf',
          fontFamily: 'monospace',
          fontSize: 14,
          background: 'rgba(0,0,0,0.55)',
          padding: '4px 10px',
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      >
        {label}
      </div>
    </div>
  )
}
