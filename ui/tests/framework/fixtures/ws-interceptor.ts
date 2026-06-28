import { Page } from '@playwright/test';

export class WsInterceptor {
  private injectedResponses: Map<string, any> = new Map();
  private messageLog: any[] = [];
  private wsRoute: any = null;
  private serverRoute: any = null;
  private attached = false;
  private routeReady: Promise<void>;
  private routeResolve: (() => void) | null = null;

  constructor(private page: Page) {
    this.routeReady = new Promise((resolve) => {
      this.routeResolve = resolve;
    });
  }

  async attach(urlPattern: string = '**/ws') {
    if (this.attached) return;
    this.attached = true;

    await this.page.routeWebSocket(urlPattern, (ws) => {
      this.wsRoute = ws;
      this.routeResolve?.();

      const server = ws.connectToServer();
      this.serverRoute = server;

      ws.onMessage((msg: string | Buffer) => {
        const raw = typeof msg === 'string' ? msg : msg.toString();
        const parsed = JSON.parse(raw);
        this.messageLog.push({ direction: 'client→server', data: msg, ts: Date.now() });

        if (parsed.type === 'chat.user' && this.injectedResponses.has('chat')) {
          const response = this.injectedResponses.get('chat')!;
          this.injectedResponses.delete('chat');
          setTimeout(() => ws.send(JSON.stringify({ type: 'chat.agent.stream', delta: response.stream })), 50);
          setTimeout(() => ws.send(JSON.stringify({ type: 'chat.agent.complete', content: response.complete })), 200);
        } else {
          server.send(msg);
        }
      });

      server.onMessage((msg: string | Buffer) => {
        this.messageLog.push({ direction: 'server→client', data: msg, ts: Date.now() });
        ws.send(msg);
      });

      ws.onClose(() => {
        this.messageLog.push({ direction: 'page→close', ts: Date.now() });
      });
    });
  }

  injectChatResponse(stream: string, complete: string) {
    this.injectedResponses.set('chat', { stream, complete });
  }

  async injectCognitiveDelta(module: string, ops: any[]) {
    await this.routeReady;
    if (!this.wsRoute) throw new Error('Interceptor not attached');
    this.wsRoute.send(JSON.stringify({ type: 'cognitive.delta', module, ops }));
  }

  async injectConfigSchema(schema: Record<string, any>) {
    await this.routeReady;
    if (!this.wsRoute) throw new Error('Interceptor not attached');
    this.wsRoute.send(JSON.stringify({ type: 'config.schema', data: schema }));
  }

  async simulateDrop(durationMs: number) {
    this.wsRoute?.close();
    this.wsRoute = null;
    this.serverRoute = null;
    this.attached = false;
    await new Promise(r => setTimeout(r, durationMs));
  }

  getLog() {
    return [...this.messageLog];
  }

  clearLog() {
    this.messageLog = [];
  }
}