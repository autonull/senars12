import { WebSocketServer } from 'ws';
import type { Agent, CognitiveEvent } from '@senars/core';
import { AgentBridge } from '@senars/core/agent-bridge';
import type { IncomingFromServer } from '@senars/core';

export interface StartUIOptions {
  port?: number;
  bootstrap?: boolean;
}

export interface TestServer {
  address(): { port: number };
  close(): Promise<void>;
}

export async function startAgentUI(agent: Agent, opts: StartUIOptions = {}): Promise<TestServer> {
  const bridge = new AgentBridge(agent);
  const port = opts.port ?? 0;
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    // Send initial handshake messages
    const handshake: IncomingFromServer[] = [
      { type: 'config.schema', data: {} } as IncomingFromServer,
      { type: 'lens.fields', fields: [] } as unknown as IncomingFromServer,
      { type: 'lens.list', lenses: [] },
      { type: 'cognitive.delta', seqId: 0, lens: 'belief', ops: [] } as IncomingFromServer,
    ];
    for (const msg of handshake) {
      ws.send(JSON.stringify(msg));
    }

    const off = bridge.onEvent((event) => {
      try {
        ws.send(JSON.stringify(event));
      } catch {
        // client disconnected
      }
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const type = (msg as { type?: string }).type;
        if (!type) return;

        if (type === 'chat.user') {
          const content = (msg as { content?: string }).content;
          if (content) {
            agent.cycle({
              text: content,
              source: 'ws',
              timestamp: Date.now(),
              correlationId: crypto.randomUUID(),
            }).catch(() => {});
          }
        }

        const delta = bridge.projectFromMessage(msg);
        if (delta) {
          ws.send(JSON.stringify(delta));
        }
      } catch {
        // malformed message
      }
    });

    ws.on('close', off);
  });

  return {
    address: () => {
      const addr = wss.address();
      if (addr && typeof addr !== 'string') return { port: addr.port };
      return { port };
    },
    close: async () => {
      for (const client of wss.clients) client.terminate();
      wss.close();
    },
  };
}
