// Cross-device sync (DESIGN §7.1 / §9).
// - BroadcastChannel: tabs in one browser (desktop testing).
// - Supabase Realtime Broadcast: two phones in a room. No tables, no server code.
// Every message carries the whole World; receivers keep the higher revision.

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { World } from './world';

export type SyncStatus = 'off' | 'connecting' | 'live' | 'error';
type Role = 'user' | 'watcher';

type Msg =
  | { type: 'world'; world: World }
  | { type: 'hello'; from: string }
  | { type: 'ping'; from: string; role: Role | null };

interface Handlers {
  onWorld: (w: World) => void;
  getWorld: () => World;
  onStatus: (s: SyncStatus) => void;
  onPeer: (role: Role | null) => void;
  deviceId: string;
  getRole: () => Role | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_KEY);

/** Room codes are short, uppercase and alphanumeric so they are easy to type on a phone. */
export const normaliseRoom = (r: string | null | undefined) =>
  (r ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);

let bc: BroadcastChannel | null = null;
let channel: RealtimeChannel | null = null;
let client: ReturnType<typeof createClient> | null = null;
let handlers: Handlers | null = null;
let pingTimer: number | undefined;

function handle(msg: Msg, reply: (m: Msg) => void) {
  if (!handlers) return;
  if (msg.type === 'world') handlers.onWorld(msg.world);
  else if (msg.type === 'hello' && msg.from !== handlers.deviceId) reply({ type: 'world', world: handlers.getWorld() });
  else if (msg.type === 'ping' && msg.from !== handlers.deviceId) handlers.onPeer(msg.role);
}

function sendAll(msg: Msg) {
  bc?.postMessage(msg);
  if (channel) void channel.send({ type: 'broadcast', event: 'msg', payload: msg });
}

export function startSync(h: Handlers, room: string) {
  stopSync();
  handlers = h;
  if ('BroadcastChannel' in window) {
    bc = new BroadcastChannel('safesip-local');
    bc.onmessage = (e) => handle(e.data as Msg, (m) => bc?.postMessage(m));
    bc.postMessage({ type: 'hello', from: h.deviceId } satisfies Msg);
  }
  if (supabaseConfigured && room) {
    h.onStatus('connecting');
    client ??= createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    channel = client.channel(`safesip:${room}`, { config: { broadcast: { self: false, ack: false } } });
    channel.on('broadcast', { event: 'msg' }, ({ payload }) => handle(payload as Msg, sendAll));
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        h.onStatus('live');
        // Ask peers for a full snapshot on (re)connect.
        void channel?.send({ type: 'broadcast', event: 'msg', payload: { type: 'hello', from: h.deviceId } satisfies Msg });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') h.onStatus('error');
      else if (status === 'CLOSED') h.onStatus('off');
    });
  } else {
    h.onStatus('off');
  }
  pingTimer = window.setInterval(() => sendAll({ type: 'ping', from: h.deviceId, role: h.getRole() }), 3000);
}

export function stopSync() {
  window.clearInterval(pingTimer);
  bc?.close();
  bc = null;
  if (channel && client) void client.removeChannel(channel);
  channel = null;
}

export function broadcastWorld(w: World) {
  sendAll({ type: 'world', world: w });
}
