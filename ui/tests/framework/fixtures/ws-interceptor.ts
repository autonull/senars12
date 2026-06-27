import { Page } from '@playwright/test';

export class WsInterceptor {
  private injectedResponses: Map<string, any> = new Map();
  private messageLog: any[] = [];
  private route: any = null;
  private serverRoute: any = null;
  private attached = false;

  constructor(private page: Page) {}

  async attach(urlPattern: string = '**/ws') {
    if (this.attached) return;
    this.attached = true;

    await this.page.routeWebSocket(urlPattern, async (ws) => {
      const serverRoute = ws.connectToServer();
      this.route = ws;
      this.serverRoute = serverRoute;

      ws.onMessage((msg: string | Buffer) => {
        const raw = typeof msg === 'string' ? msg : msg.toString();
        const parsed = JSON.parse(raw);

        this.messageLog.push({ direction: 'client→server', data: msg, ts: Date.now() });

        if (parsed.type === 'chat.user' && this.injectedResponses.has('chat')) {
          const response = this.injectedResponses.get('chat')!;
          this.injectedResponses.delete('chat');

          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'chat.agent.stream', delta: response.stream }));
          }, 50);
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'chat.agent.complete', content: response.complete }));
          }, 200);
        } else {
          serverRoute.send(msg);
        }
      });

      serverRoute.onMessage((msg: string | Buffer) => {
        this.messageLog.push({ direction: 'server→client', data: msg, ts: Date.now() });
        ws.send(msg);
      });
    });
  }

  injectChatResponse(stream: string, complete: string) {
    this.injectedResponses.set('chat', { stream, complete });
  }

  async injectCognitiveDelta(module: string, ops: any[]) {
    const r = this.route;
    if (!r) throw new Error('Interceptor not attached');
    r.send(JSON.stringify({ type: 'cognitive.delta', module, ops }));
  }

  async injectConfigSchema(schema: Record<string, any>) {
    const r = this.route;
    if (!r) throw new Error('Interceptor not attached');
    r.send(JSON.stringify({ type: 'config.schema', data: schema }));
  }

  async simulateDrop(durationMs: number) {
    if (this.route) {
      await this.route.close().catch(() => {});
      this.route = null;
      this.serverRoute = null;
    }
    await new Promise(r => setTimeout(r, durationMs));
  }

  getLog() {
    return [...this.messageLog];
  }

  clearLog() {
    this.messageLog = [];
  }
}
