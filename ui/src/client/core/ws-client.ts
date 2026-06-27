import { z } from 'zod';
import { IncomingFromServer, SyncRequest } from '../../shared/protocol.js';
import { $connectionState, $lastSeqId } from './store.js';
import { applyServerMessage } from './store-bindings.js';
import type { IncomingFromServer as IncomingFromServerType } from '../../shared/protocol.js';

const WS_URL = `ws://${location.host}/ws`;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10000;

let socket: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;

export function connect() {
  $connectionState.set(socket ? 'reconnecting' : 'connecting');
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    reconnectAttempt = 0;
    $connectionState.set('connected');
    const req: z.infer<typeof SyncRequest> = {
      type: 'sync.request',
      last_seq_id: $lastSeqId.get(),
    };
    socket!.send(JSON.stringify(req));
    pingInterval = setInterval(() => {
      socket!.send(JSON.stringify({ type: 'ping', t0: performance.now() }));
    }, 5000);
  };

  socket.onmessage = (ev) => {
    if (ev.data === 'pong') return;
    const raw = JSON.parse(ev.data as string);
    const parsed = IncomingFromServer.safeParse(raw);
    if (!parsed.success) {
      console.error('[WS] Malformed message dropped:', parsed.error, raw);
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

function scheduleReconnect() {
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** reconnectAttempt++);
  reconnectTimer = setTimeout(connect, delay);
}

export function send(msg: Record<string, unknown>) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

export function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pingInterval) clearInterval(pingInterval);
  socket?.close();
  socket = null;
  $connectionState.set('disconnected');
}
