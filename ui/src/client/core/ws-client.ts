import { z } from 'zod';
import { IncomingFromServer, SyncRequest, type IncomingFromServer as IncomingFromServerType } from '../../shared/protocol.js';
import { $connectionState, $lastSeqId } from './store.js';
import { applyServerMessage } from './store-bindings.js';

const WS_URL = `ws://${location.host}/ws`;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const PING_INTERVAL_MS = 5_000;

let socket: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;

export function connect(): void {
  $connectionState.set(socket ? 'reconnecting' : 'connecting');
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    reconnectAttempt = 0;
    $connectionState.set('connected');
    socket!.send(JSON.stringify({ type: 'sync.request', last_seq_id: $lastSeqId.get() } satisfies z.infer<typeof SyncRequest>));
    pingInterval = setInterval(() => {
      socket?.send(JSON.stringify({ type: 'ping', t0: performance.now() }));
    }, PING_INTERVAL_MS);
  };

  socket.onmessage = (ev) => {
    if (ev.data === 'pong') return;
    const parsed = IncomingFromServer.safeParse(JSON.parse(ev.data as string));
    if (!parsed.success) {
      console.error('[WS] Malformed message dropped:', parsed.error, ev.data);
      return;
    }
    applyServerMessage(parsed.data as IncomingFromServerType);
  };

  socket.onclose = () => {
    $connectionState.set('reconnecting');
    if (pingInterval) clearInterval(pingInterval);
    scheduleReconnect();
  };

  socket.onerror = () => socket?.close();
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** reconnectAttempt++);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
}

export function send(msg: Record<string, unknown>): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

export function disconnect(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
  socket?.close();
  socket = null;
  $connectionState.set('disconnected');
}
