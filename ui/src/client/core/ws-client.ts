import { IncomingMessage } from '../../shared/protocol.js';

type MessageHandler = (msg: any) => void;
type StatusHandler = (status: string) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<StatusHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: string[] = [];
  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

  get status() { return this._status; }

  private setStatus(s: typeof WsClient.prototype._status) {
    if (this._status === s) return;
    this._status = s;
    for (const h of this.statusHandlers) h(s);
  }

  onStatusChange(h: StatusHandler) { this.statusHandlers.add(h); }

  offStatusChange(h: StatusHandler) { this.statusHandlers.delete(h); }

  connect(url = `ws://${location.host}/ws`) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.setStatus('connecting');
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.setStatus('connected');
      for (const msg of this.pendingMessages) {
        this.ws?.send(msg);
      }
      this.pendingMessages = [];
    };

    this.ws.onmessage = (event) => {
      let parsed: any;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        console.error('[ws] Failed to parse message');
        return;
      }

      const result = IncomingMessage.safeParse(parsed);
      if (!result.success) {
        console.error('[ws] Zod validation failed:', result.error);
        return;
      }

      const msg = result.data;
      const typeHandlers = this.handlers.get(msg.type);
      if (typeHandlers) {
        for (const handler of typeHandlers) {
          handler(msg);
        }
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.setStatus('disconnected');
      this.reconnectTimer = setTimeout(() => {
        this.setStatus('connecting');
        this.connect(url);
      }, 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  send(msg: object) {
    const raw = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else {
      this.pendingMessages.push(raw);
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}

export const wsClient = new WsClient();
wsClient.connect();
