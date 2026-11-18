import type { MqttClient } from 'mqtt'

/**
 * Lobby networking through free public MQTT brokers (secure WebSockets on port 443-style
 * ports, so it works on home wi-fi, mobile data and most work networks – unlike direct
 * browser-to-browser WebRTC, which strict routers/firewalls often block).
 *
 * The HOST's browser runs the game; guests send it actions and receive the full state back.
 * Room messages are not secret (anyone who knows the room code could read them) – fine for a game.
 */

const BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
]
const TOPIC_ROOT = 'actorconnect/v1'
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L confusion

export function randomRoomCode(len = 5) {
  return Array.from({ length: len }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

export function cleanRoomCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** Guests → host (topic .../host) */
type GuestMsg =
  | { t: 'hello', from: string, name: string }
  | { t: 'act', from: string, action: unknown }
  | { t: 'bye', from: string }

/** Host → everyone (topic .../all) */
type HostMsg =
  | { t: 'state', state: unknown }
  | { t: 'bye' }

const topics = (code: string) => ({
  host: `${TOPIC_ROOT}/${code}/host`,
  all: `${TOPIC_ROOT}/${code}/all`,
})

function parse<T>(buf: Uint8Array | string): T | null {
  try {
    return JSON.parse(typeof buf === 'string' ? buf : new TextDecoder().decode(buf)) as T
  }
  catch {
    return null
  }
}

async function connect(url: string, clientId: string, will?: { topic: string, payload: string }): Promise<MqttClient> {
  const { default: mqtt } = await import('mqtt')
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, {
      clientId: `ac_${clientId}_${randomId()}`,
      keepalive: 10, // broker notices a vanished player within ~15s
      connectTimeout: 8000,
      reconnectPeriod: 2000,
      clean: true,
      // If this tab dies without saying goodbye, the broker says it for us
      will: will ? { topic: will.topic, payload: will.payload, qos: 1, retain: false } : undefined,
    })
    const timer = setTimeout(() => {
      client.end(true)
      reject(new Error('timeout'))
    }, 9000)
    client.once('connect', () => {
      clearTimeout(timer)
      resolve(client)
    })
  })
}

/** Closing the tab: say goodbye straight away (the broker's "will" is the backup) */
function onTabClose(fn: () => void) {
  window.addEventListener('pagehide', fn)
  return () => window.removeEventListener('pagehide', fn)
}

/* ---------------------------------- HOST ---------------------------------- */

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
  const id = `h_${randomId()}`
  const code = randomRoomCode()
  const t = topics(code)
  const bye = JSON.stringify({ t: 'bye' } satisfies HostMsg)

  // First broker that answers wins; guests listen on all of them
  let client: MqttClient | null = null
  for (const url of BROKERS) {
    try {
      client = await connect(url, id, { topic: t.all, payload: bye })
      break
    }
    catch {}
  }
  if (!client) throw new Error('Could not reach the multiplayer service. Check your internet connection.')

  const guests = new Set<string>()
  let lastState: string | null = null
  const publishState = () => {
    if (lastState) client!.publish(t.all, lastState, { qos: 1 })
  }

  client.subscribe(t.host, { qos: 1 })
  client.on('message', (_topic, payload) => {
    const msg = parse<GuestMsg>(payload)
    if (!msg?.from) return
    if (msg.t === 'hello') {
      guests.add(msg.from)
      events.onJoin(msg.from, String(msg.name ?? 'Player'))
      publishState() // make sure the newcomer gets the current game straight away
    }
    else if (msg.t === 'act' && guests.has(msg.from)) {
      events.onAction(msg.from, msg.action)
    }
    else if (msg.t === 'bye' && guests.delete(msg.from)) {
      events.onLeave(msg.from)
    }
  })

  const sayBye = () => client?.publish(t.all, bye, { qos: 1 })
  const offTabClose = onTabClose(sayBye)

  return {
    id,
    code,
    broadcast(state) {
      lastState = JSON.stringify({ t: 'state', state } satisfies HostMsg)
      publishState()
    },
    destroy() {
      offTabClose()
      sayBye()
      const c = client
      client = null
      setTimeout(() => c?.end(), 300) // let the goodbye go out first
    },
  }
}

/* ---------------------------------- GUEST ---------------------------------- */

export interface GuestHandle {
  id: string
  send: (action: unknown) => void
  destroy: () => void
}

export async function joinHost(code: string, name: string, events: {
  onState: (state: unknown, you: string) => void
  onClose: (reason: string) => void
}): Promise<GuestHandle> {
  const id = `g_${randomId()}`
  const t = topics(code)
  const bye = JSON.stringify({ t: 'bye', from: id } satisfies GuestMsg)
  const hello = JSON.stringify({ t: 'hello', from: id, name } satisfies GuestMsg)

  // We don't know which broker the host picked, so knock on every door at once
  const clients = (await Promise.all(
    BROKERS.map(url => connect(url, id, { topic: t.host, payload: bye }).catch(() => null)),
  )).filter((c): c is MqttClient => !!c)

  if (!clients.length) throw new Error('Could not reach the multiplayer service. Check your internet connection.')

  return new Promise((resolve, reject) => {
    let chosen: MqttClient | null = null
    let closed = false

    const timer = setTimeout(() => {
      clients.forEach(c => c.end(true))
      reject(new Error(`Couldn't find room ${code}. Check the code, and make sure the host still has the game open.`))
    }, 10000)

    for (const c of clients) {
      c.subscribe(t.all, { qos: 1 }, () => c.publish(t.host, hello, { qos: 1 }))
      c.on('message', (_topic, payload) => {
        const msg = parse<HostMsg>(payload)
        if (!msg) return

        // First reply tells us which broker the host is on – drop the others
        if (!chosen && msg.t === 'state') {
          chosen = c
          clearTimeout(timer)
          clients.filter(o => o !== c).forEach(o => o.end(true))
          const offTabClose = onTabClose(() => c.publish(t.host, bye, { qos: 1 }))
          resolve({
            id,
            send(action) {
              c.publish(t.host, JSON.stringify({ t: 'act', from: id, action } satisfies GuestMsg), { qos: 1 })
            },
            destroy() {
              closed = true
              offTabClose()
              c.publish(t.host, bye, { qos: 1 })
              setTimeout(() => c.end(), 300)
            },
          })
        }
        if (c !== chosen || closed) return

        if (msg.t === 'state') {
          events.onState(msg.state, id)
        }
        else if (msg.t === 'bye') {
          closed = true
          c.end(true)
          events.onClose('The host left the game.')
        }
      })
    }
  })
}
