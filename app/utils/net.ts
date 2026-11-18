import type { DataConnection, Peer } from 'peerjs'

/**
 * Tiny peer-to-peer layer for lobbies, using PeerJS's free public matchmaking server.
 * The HOST's browser runs the game; guests send it actions and receive the full state back.
 */

const PREFIX = 'actorconnect-'
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L confusion

export function randomRoomCode(len = 5) {
  return Array.from({ length: len }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

export function cleanRoomCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

/** Messages guest → host */
export type GuestMsg =
  | { t: 'hello', name: string }
  | { t: 'act', action: unknown }
  | { t: 'bye' }

/** Messages host → guest */
export type HostMsg =
  | { t: 'state', state: unknown, you: string }
  | { t: 'bye' }

/** Closing a tab doesn't reliably close WebRTC links straight away, so we say goodbye explicitly */
function onTabClose(fn: () => void) {
  window.addEventListener('pagehide', fn)
  return () => window.removeEventListener('pagehide', fn)
}

async function makePeer(id?: string): Promise<Peer> {
  const { Peer } = await import('peerjs')
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id) : new Peer()
    const timer = setTimeout(() => {
      peer.destroy()
      reject(new Error('timeout'))
    }, 12000)
    peer.once('open', () => {
      clearTimeout(timer)
      resolve(peer)
    })
    peer.once('error', (e: any) => {
      clearTimeout(timer)
      peer.destroy()
      reject(e)
    })
  })
}

export interface HostHandle {
  id: string
  code: string
  broadcast: (state: unknown) => void
  destroy: () => void
}

export async function createHost(events: {
  onJoin: (id: string, name: string) => void
  onLeave: (id: string) => void
  onAction: (id: string, action: unknown) => void
}): Promise<HostHandle> {
  // Retry if the random code happens to be taken
  let peer: Peer | null = null
  let code = ''
  for (let i = 0; i < 4 && !peer; i++) {
    code = randomRoomCode()
    try {
      peer = await makePeer(PREFIX + code)
    }
    catch (e: any) {
      if (e?.type !== 'unavailable-id') throw e
    }
  }
  if (!peer) throw new Error('Could not create a room. Try again.')

  const conns = new Map<string, DataConnection>()
  let lastState: unknown = null

  peer.on('connection', (conn) => {
    const drop = () => {
      if (conns.delete(conn.peer)) events.onLeave(conn.peer)
    }
    conn.on('data', (raw) => {
      const msg = raw as GuestMsg
      if (msg?.t === 'hello') {
        conns.set(conn.peer, conn)
        events.onJoin(conn.peer, String(msg.name ?? 'Player'))
        if (lastState) conn.send({ t: 'state', state: lastState, you: conn.peer } satisfies HostMsg)
      }
      else if (msg?.t === 'act') {
        events.onAction(conn.peer, msg.action)
      }
      else if (msg?.t === 'bye') {
        drop()
        conn.close()
      }
    })
    conn.on('close', drop)
    conn.on('error', drop)
  })

  // The matchmaking server can drop us; the game itself keeps working over existing connections
  peer.on('disconnected', () => peer?.reconnect())

  const sayBye = () => {
    for (const c of conns.values()) {
      if (c.open) c.send({ t: 'bye' } satisfies HostMsg)
    }
  }
  const offTabClose = onTabClose(sayBye)

  return {
    id: peer.id,
    code,
    broadcast(state) {
      lastState = state
      for (const [id, c] of conns) {
        if (c.open) c.send({ t: 'state', state, you: id } satisfies HostMsg)
      }
    },
    destroy() {
      offTabClose()
      sayBye()
      // give the goodbye a moment to go out before hanging up
      const p = peer
      setTimeout(() => p?.destroy(), 300)
    },
  }
}

export interface GuestHandle {
  id: string
  send: (action: unknown) => void
  destroy: () => void
}

export async function joinHost(code: string, name: string, events: {
  onState: (state: unknown, you: string) => void
  onClose: (reason: string) => void
}): Promise<GuestHandle> {
  const peer = await makePeer()

  return new Promise((resolve, reject) => {
    let opened = false
    let closed = false
    const conn = peer.connect(PREFIX + code, { reliable: true })

    const fail = (reason: string) => {
      if (closed) return
      closed = true
      if (!opened) {
        peer.destroy()
        reject(new Error(reason))
      }
      else {
        events.onClose(reason)
      }
    }

    const timer = setTimeout(() => fail(`Couldn't reach room ${code}. Check the code, or ask the host to make sure their game is still open.`), 12000)

    peer.on('error', (e: any) => {
      clearTimeout(timer)
      fail(e?.type === 'peer-unavailable'
        ? `No game found with code ${code}. Check the link, or ask the host to start a new lobby.`
        : 'Connection problem. Try again.')
    })

    conn.on('open', () => {
      clearTimeout(timer)
      opened = true
      conn.send({ t: 'hello', name } satisfies GuestMsg)
      const sayBye = () => {
        if (conn.open) conn.send({ t: 'bye' } satisfies GuestMsg)
      }
      const offTabClose = onTabClose(sayBye)
      resolve({
        id: peer.id,
        send(action) {
          if (conn.open) conn.send({ t: 'act', action } satisfies GuestMsg)
        },
        destroy() {
          closed = true
          offTabClose()
          sayBye()
          setTimeout(() => peer.destroy(), 300)
        },
      })
    })
    conn.on('data', (raw) => {
      const msg = raw as HostMsg
      if (msg?.t === 'state') events.onState(msg.state, msg.you)
      else if (msg?.t === 'bye') fail('The host left the game.')
    })
    conn.on('close', () => fail('The host left the game.'))
  })
}
