import { IncomingFromServer, type IncomingFromServer as IncomingMessage } from '@senars/core';
import { $connectionState, $lastSeqId, atom } from './store.js';
import { applyServerMessage } from './store-bindings.js';

function resolveWsUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost/ws';
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}/ws`;
}

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 20;
const PING_INTERVAL_MS = 25_000;
const MAX_PENDING_MESSAGES = 100;
const PENDING_TTL_MS = 60_000;

type PendingMessage = { message: Record<string, unknown>; at: number };

let socket: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pendingMessages: PendingMessage[] = [];

export const $reconnectAttempt = atom(0);

function getBackoffDelay(attempt: number): number {
  // Deterministic exponential backoff: no jitter, so a replayed reconnect
  // schedule is reproducible and the delay is a pure function of the attempt.
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
}

function dropExpired(now: number): void {
  pendingMessages = pendingMessages.filter((entry) => now - entry.at < PENDING_TTL_MS);
}

export function connect(): void {
  $connectionState.set(socket ? 'reconnecting' : 'connecting');
  const ws = new WebSocket(resolveWsUrl());
  socket = ws;
  // Handlers belong to this socket instance: a superseded socket's late
  // `onclose` (from `reconnect()`/`disconnect()`) must not schedule a reconnect
  // for the connection that replaced it.
  const isCurrent = () => socket === ws;

  ws.onopen = () => {
    if (!isCurrent()) return;
    reconnectAttempt = 0;
    $reconnectAttempt.set(0);
    $connectionState.set('connected');
    ws.send(JSON.stringify({ type: 'sync.request', lastSeqId: $lastSeqId.get() }));
    flushPending();
    startPing();
  };

  ws.onmessage = (ev) => {
    if (!isCurrent() || ev.data === 'pong') return;
    let json: unknown;
    try {
      json = JSON.parse(ev.data as string);
    } catch {
      console.error('[WS] Dropped non-JSON frame');
      return;
    }
    const parsed = IncomingFromServer.safeParse(json);
    if (!parsed.success) {
      console.error('[WS] Malformed message dropped:', parsed.error, ev.data);
      return;
    }
    applyServerMessage(parsed.data as IncomingMessage);
  };

  ws.onclose = () => {
    if (!isCurrent()) return;
    stopPing();
    $connectionState.set('reconnecting');
    scheduleReconnect();
  };

  ws.onerror = () => ws.close();
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
    $connectionState.set('disconnected');
    return;
  }
  const delay = getBackoffDelay(reconnectAttempt++);
  $reconnectAttempt.set(reconnectAttempt);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function startPing(): void {
  stopPing();
  pingTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send('ping');
    }
  }, PING_INTERVAL_MS);
}

function stopPing(): void {
  if (pingTimer !== null) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function flushPending(): void {
  dropExpired(Date.now());
  if (pendingMessages.length === 0) return;
  const batch = pendingMessages;
  pendingMessages = [];
  for (const { message } of batch) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

export function send(msg: Record<string, unknown>): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
    return;
  }
  // Bounded: an offline client used to queue without limit. The oldest intent is
  // the least likely to still matter, so it is dropped rather than the newest.
  dropExpired(Date.now());
  if (pendingMessages.length >= MAX_PENDING_MESSAGES) pendingMessages.shift();
  pendingMessages.push({ message: msg, at: Date.now() });
}

/**
 * User-triggered reconnect. `disconnect()` was the only reset path, so a manual
 * retry after the attempt limit left the counter saturated and the next close
 * refused to schedule. This clears the schedule and attempt budget, keeping the
 * offline queue so queued intent still lands on the new socket.
 */
export function reconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  socket?.close();
  socket = null;
  reconnectAttempt = 0;
  $reconnectAttempt.set(0);
  connect();
}

export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopPing();
  socket?.close();
  socket = null;
  pendingMessages = [];
  $connectionState.set('disconnected');
  $reconnectAttempt.set(0);
}
