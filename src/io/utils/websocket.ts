import { WebSocket } from 'ws';
import { makeId, toError } from '../../../nar/src/utils';

export interface WSClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  heartbeat: NodeJS.Timeout;
  lastSeen: number;
}

export interface WSClientOptions {
  heartbeatInterval?: number;
  onMessage?: (data: Record<string, unknown>, client: WSClient) => void;
  onClose?: (client: WSClient) => void;
  onError?: (error: Error, client: WSClient) => void;
}

export const createWSClient = (
  ws: WebSocket,
  id: string = makeId(),
  options: WSClientOptions = {}
): WSClient => {
  const { heartbeatInterval = 30000, onMessage, onClose, onError } = options;
  const client: WSClient = {
    ws,
    id,
    subscriptions: new Set(),
    heartbeat: setInterval(() => sendHeartbeat(ws), heartbeatInterval),
    lastSeen: Date.now(),
  };

  ws.on('message', (data) => {
    client.lastSeen = Date.now();
    try {
      onMessage?.(JSON.parse(data.toString()), client);
    } catch (e) {
      onError?.(toError(e), client);
    }
  });

  ws.on('close', () => {
    clearInterval(client.heartbeat);
    onClose?.(client);
  });

  ws.on('error', (err) => {
    clearInterval(client.heartbeat);
    onError?.(err, client);
  });

  ws.send(JSON.stringify({ type: 'connected', id }));
  return client;
};

export const cleanupWSClient = (client: WSClient, code = 1000, reason = 'Server closing'): void => {
  clearInterval(client.heartbeat);
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.close(code, reason);
  }
};

export const sendHeartbeat = (ws: WebSocket): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
  }
};

export const sendWSMessage = (
  ws: WebSocket,
  type: string,
  data?: Record<string, unknown>
): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data, timestamp: Date.now() }));
  }
};

export const subscribeToEvents = (
  subscriptions: Map<string, Set<WebSocket>>,
  client: WSClient,
  events: string[]
): void => {
  for (const event of events) {
    let set = subscriptions.get(event);
    if (!set) {
      set = new Set();
      subscriptions.set(event, set);
    }
    set.add(client.ws);
    client.subscriptions.add(event);
  }
};

export const unsubscribeFromEvents = (
  subscriptions: Map<string, Set<WebSocket>>,
  client: WSClient,
  events: string[]
): void => {
  for (const event of events) {
    subscriptions.get(event)?.delete(client.ws);
    client.subscriptions.delete(event);
  }
};

export const broadcastToSubscribers = (
  subscribers: Set<WebSocket> | undefined,
  event: string,
  data?: Record<string, unknown>
): void => {
  if (!subscribers) return;
  const message = JSON.stringify({ type: 'event', event, data, timestamp: Date.now() });
  for (const ws of subscribers) {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  }
};
