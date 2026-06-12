export type Dir = 'up' | 'down' | 'left' | 'right' | 'idle'

// Client → Server
export interface HelloMsg { type: 'hello'; name?: string }
export interface InputMsg { type: 'input'; seq: number; dt: number; dir: Dir }
export interface EmoteMsg { type: 'emote'; kind: 'wave' | 'heart' | 'question' | 'bang' }
export interface KickMsg { type: 'kick'; dir: { x: number; y: number } }
export interface NoteMsg { type: 'note'; text: string; x: number; y: number }
export interface PingMsg { type: 'ping'; t: number }

export type ClientMsg = HelloMsg | InputMsg | EmoteMsg | KickMsg | NoteMsg | PingMsg

// Server → Client
export interface WelcomeMsg {
  type: 'welcome'
  selfId: string
  mapVersion: number
  snapshot: unknown
}
export interface SnapMsg {
  type: 'snap'
  tick: number
  baseTick?: number
  entities: unknown[]
}
export interface EventMsg {
  type: 'event'
  kind: 'join' | 'leave' | 'emote' | 'note' | 'goal'
  payload: unknown
}
export interface PongMsg { type: 'pong'; t: number; serverTime: number }
export interface ErrorMsg { type: 'error'; code: 'rate_limited' | 'banned' | 'full' }

export type ServerMsg = WelcomeMsg | SnapMsg | EventMsg | PongMsg | ErrorMsg
