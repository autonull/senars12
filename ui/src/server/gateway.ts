import { WebSocket } from 'ws';
import { IncomingFromClient } from '../shared/protocol.js';
import { RateLimiter } from './rate-limiter.js';
import { validateClientMessage } from './validators.js';
import type { Lens, IncomingFromServer } from '../shared/protocol.js';

const MAX_BUFFER_BYTES = 1_048_576;
const HEARTBEAT_INTERVAL_MS = 30_000;

interface EventBufferEntry {
  seq: number;
  msg: IncomingFromServer;
}

interface PendingChatResponse {
  stream: string;
  complete: string;
}

let pendingChatResponse: PendingChatResponse | null = null;

export function setPendingChatResponse(stream: string, complete: string) {
  pendingChatResponse = { stream, complete };
}

export function consumePendingChatResponse(): PendingChatResponse | undefined {
  if (!pendingChatResponse) return undefined;
  const response = pendingChatResponse;
  pendingChatResponse = null;
  return response;
}

export interface NarAdapter {
  listConcepts(): Array<{
    term: string;
    priority: number;
    confidence: number;
    getLinks(): Array<{ target: string; strength: number }>;
  }>;
  getSystemEventBus(): {
    on(event: string, handler: (...args: any[]) => void): () => void;
  };
  attentionReport(): { concepts: Array<{ term: string; priority: number }> };
  getDriveManager(): {
    getAllStates(): Array<{ spec: { id: string; name: string }; currentIntensity: number; isActive: boolean }>;
  } | undefined;
  getConfigSchema(): Record<string, any>;
  setConfig(key: string, value: any): void;
}

export function handleConnection(socket: WebSocket, nar: NarAdapter, onChat: (content: string, send: (msg: IncomingFromServer) => void) => void, onLensChange?: (lens: Lens) => void) {
  const limiter = new RateLimiter({ chat: 5, config: 10 });
  let lastSeqId = 0;
  const eventBuffer: EventBufferEntry[] = [];
  const MAX_BUFFER_SIZE = 1000;

  let alive = true;
  socket.on('pong', () => { alive = true; });
  const heartbeat = setInterval(() => {
    if (!alive) return socket.terminate();
    alive = false;
    socket.ping();
  }, HEARTBEAT_INTERVAL_MS);

  function send(msg: IncomingFromServer) {
    if (socket.bufferedAmount > MAX_BUFFER_BYTES) {
      if (msg.type !== 'chat.agent.stream' && msg.type !== 'chat.agent.complete') return;
    }
    const payload = JSON.stringify(msg);
    socket.send(payload);
    if (msg.type === 'cognitive.delta' || msg.type === 'state.snapshot') {
      eventBuffer.push({ seq: ++lastSeqId, msg });
      if (eventBuffer.length > MAX_BUFFER_SIZE) eventBuffer.shift();
    }
  }

  socket.on('message', (raw) => {
    const validation = validateClientMessage(raw.toString());
    if (!validation.success) {
      send({ type: 'chat.agent.complete', content: `Error: ${validation.error.message}` });
      return;
    }
    const msg = validation.data;

    if (msg.type === 'chat.user') {
      if (!limiter.consume('chat')) return;
      onChat(msg.content, send);
    }
    if (msg.type === 'config.set') {
      if (!limiter.consume('config')) return;
      nar.setConfig(msg.key, msg.value);
    }
    if (msg.type === 'lens.set') {
      onLensChange?.(msg.lens);
    }
    if (msg.type === 'sync.request') {
      handleSync(msg.last_seq_id, eventBuffer, send, nar);
    }
  });

  socket.on('close', () => {
    clearInterval(heartbeat);
  });
}

function handleSync(
  lastSeqId: number | null,
  buffer: EventBufferEntry[],
  send: (m: IncomingFromServer) => void,
  nar: NarAdapter,
) {
  if (lastSeqId === null || buffer.length === 0 || buffer[buffer.length - 1]!.seq - lastSeqId > buffer.length) {
    const concepts = nar.listConcepts();
    const config = nar.getConfigSchema();
    const report = nar.attentionReport();
    const seq_id = buffer.length > 0 ? buffer[buffer.length - 1]!.seq : 0;
    send({
      type: 'state.snapshot',
      seq_id,
      data: {
        graph: {
          nodes: concepts.map(c => ({ id: c.term, priority: c.priority, confidence: c.confidence })),
          edges: concepts.flatMap(c =>
            c.getLinks().map(l => ({ source: c.term, target: l.target, weight: l.strength })),
          ),
        },
        working_memory: report.concepts.map(c => ({ id: c.term, priority: c.priority })),
        config,
      },
    });
  } else {
    for (const entry of buffer) {
      if (entry.seq > lastSeqId) send(entry.msg);
    }
  }
}