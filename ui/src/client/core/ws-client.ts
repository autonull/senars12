import { IncomingFromServer, type IncomingFromServer as IncomingMessage } from '@senars/core';
import { applyServerMessage } from './store-bindings.js';
import { $connectionState, $lastSeqId, atom } from './store.js';

function resolveWsUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost/ws';
  return `ws://${location.host}/ws`;
}
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 20;
const PING_INTERVAL_MS = 25_000;

let socket: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pendingMessages: unknown[] = [];

export const $reconnectAttempt = atom(0);

function getBackoffDelay(attempt: number): number {
  const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(base * jitter);
}

export function connect(): void {
  $connectionState.set(socket ? 'reconnecting' : 'connecting');
  socket = new WebSocket(resolveWsUrl());

  socket.onopen = () => {
    reconnectAttempt = 0;
    $reconnectAttempt.set(0);
    $connectionState.set('connected');
    socket?.send(JSON.stringify({ type: 'sync.request', lastSeqId: $lastSeqId.get() }));
    flushPending();
    startPing();
  };

  socket.onmessage = (ev) => {
    if (ev.data === 'pong') return;
    const parsed = IncomingFromServer.safeParse(JSON.parse(ev.data as string));
    if (!parsed.success) {
      console.error('[WS] Malformed message dropped:', parsed.error, ev.data);
      return;
    }
    applyServerMessage(parsed.data as IncomingMessage);
  };

  socket.onclose = () => {
    stopPing();
    $connectionState.set('reconnecting');
    scheduleReconnect();
  };

  socket.onerror = () => socket?.close();
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
  if (pendingMessages.length === 0) return;
  const batch = pendingMessages;
  pendingMessages = [];
  for (const msg of batch) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }
}

export function send(msg: Record<string, unknown>): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  } else {
    pendingMessages.push(msg);
  }
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
