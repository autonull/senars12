import type { WebSocket } from 'ws';
import type { LensSpec } from '@senars/core/lens-schema';
import { BUILTIN_LENS_IDS, LensSpecSchema, builtinLensSpecs } from '@senars/core/lens-schema';
import type { ConfigFieldType, IncomingFromServer, Lens } from '@senars/core/protocol';
import type { BridgeLike } from './bridge-like.js';
import { RateLimiter } from './rate-limiter.js';
import { validateClientMessage } from './validators.js';

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

/** Stores a pending chat response for test injection. */
export function setPendingChatResponse(stream: string, complete: string) {
  pendingChatResponse = { stream, complete };
}

/** Consumes and clears the pending chat response. */
export function consumePendingChatResponse(): PendingChatResponse | undefined {
  if (!pendingChatResponse) return undefined;
  const response = pendingChatResponse;
  pendingChatResponse = null;
  return response;
}

/** In-memory lens registry shared across connections. */
export const lensRegistry: Map<string, LensSpec> = new Map();

/** Initialise the registry with built-in lenses. */
export function initLensRegistry(): void {
  for (const spec of builtinLensSpecs()) {
    lensRegistry.set(spec.id, spec);
  }
}

/** Register a user-defined lens. Returns null on validation failure. */
export function registerServerLens(spec: LensSpec): LensSpec | null {
  const parsed = LensSpecSchema.safeParse(spec);
  if (!parsed.success) return null;
  lensRegistry.set(parsed.data.id, parsed.data);
  return parsed.data;
}

export type SendFn = (msg: IncomingFromServer) => void;

/** Handles an incoming WebSocket connection using a BridgeLike. */
export function handleConnection(
  socket: WebSocket,
  bridge: BridgeLike,
  onChat: (content: string, send: SendFn) => void,
  onLensChange?: (lens: Lens) => void,
  onFocusChange?: (term: string) => void,
  onLensDefine?: (spec: LensSpec, send: SendFn) => void
): void {
  const limiter = new RateLimiter({ chat: 5, config: 10 });
  let lastSeqId = 0;
  const eventBuffer: EventBufferEntry[] = [];
  const MAX_BUFFER_SIZE = 1000;

  let alive = true;
  socket.on('pong', () => {
    alive = true;
  });
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
      return;
    }
    const msg = validation.data;

    if (msg.type === 'chat.user') {
      if (!limiter.consume('chat')) return;
      onChat(msg.content, send);
    }
    if (msg.type === 'config.set') {
      if (!limiter.consume('config')) return;
      bridge.setConfig(msg.key, msg.value);
    }
    if (msg.type === 'lens.set') {
      onLensChange?.(msg.lens);
    }
    if (msg.type === 'sync.request') {
      handleSync(msg.lastSeqId, eventBuffer, send, bridge);
    }
    if (msg.type === 'focus.set') {
      onFocusChange?.(msg.term);
    }
    if (msg.type === 'object.set') {
      if (msg.kind === 'node' && msg.patch.truth) {
        bridge.setNodeTruth(msg.id, msg.patch.truth);
      }
      if (msg.kind === 'edge') {
        if (msg.patch.truth) bridge.setNodeTruth?.(msg.id, msg.patch.truth);
      }
    }
    if (msg.type === 'node.set') {
      if (msg.patch.truth) bridge.setNodeTruth(msg.id, msg.patch.truth);
    }
    if (msg.type === 'lens.define') {
      const valid = LensSpecSchema.safeParse(msg.lens);
      if (valid.success) {
        registerServerLens(valid.data);
        onLensDefine?.(valid.data, send);
      }
    }
    if (msg.type === 'node.history.request') {
      bridge.onNodeHistoryRequest(msg.term);
    }
  });

  socket.on('close', () => {
    clearInterval(heartbeat);
  });
}

function handleSync(
  lastSeqId: number | null,
  buffer: EventBufferEntry[],
  send: SendFn,
  bridge: BridgeLike
): void {
  const bufLen = buffer.length;
  const lastEntry = bufLen > 0 ? buffer[bufLen - 1] : null;
  if (lastSeqId === null || bufLen === 0 || (lastEntry?.seq ?? 0) - lastSeqId > bufLen) {
    const concepts = bridge.listConcepts();
    const config = bridge.getConfigSchema();
    const report = bridge.attentionReport();
    const seqId = lastEntry?.seq ?? 0;
    send({
      type: 'state.snapshot',
      seqId,
      data: {
        graph: {
          nodes: concepts.map((c) => ({
            id: c.term,
            label: c.term,
            priority: c.priority,
            confidence: c.confidence,
            nodeType: 'concept',
            isContradiction: c.isContradiction,
          })),
          edges: concepts.flatMap((c) =>
            c.getLinks().map((l) => ({ source: c.term, target: l.target, weight: l.strength }))
          ),
        },
        workingMemory: report.concepts.map((c) => ({ id: c.term, priority: c.priority })),
        config,
      },
    });
  } else {
    for (const entry of buffer) {
      if (entry.seq > lastSeqId) send(entry.msg);
    }
  }
}
