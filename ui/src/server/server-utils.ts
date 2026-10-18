/**
 * Shared server utilities used by both the handler registry and the main server.
 */
import type { IncomingFromServer, CognitiveEvent, GraphNodeData } from '@senars/core';
import { mintCognitiveEvent, type DerivationRecord } from '@senars/core/schemas';
import { termParser } from '@senars/nar';
import { makeId, splitLines } from '@senars/util';
import { WebSocket } from 'ws';
import { applyConfigField, buildConfigSchema } from './config-schema.js';
import { spendTerminations, type SpendSummary, mergeSpendSummaries } from './spend-terminations.js';
import { LM_PROVIDER_NAMES } from '@senars/nar/lm';

export { applyConfigField, LM_PROVIDER_NAMES, spendTerminations, mergeSpendSummaries };

export type Truth = { frequency: number; confidence: number };
export type RevisionEntry = {
  truth: Truth;
  stampId: string;
  timestamp: number;
  source: 'input' | 'derivation' | 'revision' | 'inference';
};
export type NarBelief = { term: { toString(): string }; truth: { f: number; c: number } };
export type NarAnswer = {
  answer?: string;
  truth?: { f: number; c: number };
  derivation?: { record: DerivationRecord };
};
export type DerivationRecorderLike = {
  drain(): DerivationRecord[];
  pending(): number;
};
export type NarProcessorLike = {
  getRecorder(): DerivationRecorderLike;
};
export type NarLike = {
  believe?: (statement: string, truth?: { f: number; c: number }) => Promise<void>;
  goal?: (statement: string) => Promise<void>;
  question?: (statement: string) => Promise<void>;
  retract?: (term: string) => boolean;
  revise?: (term: string, truth: { f: number; c: number }) => Promise<void>;
  run?: (cycles: number, signal?: AbortSignal) => unknown;
  askWithDerivation?: (question: string) => Promise<NarAnswer>;
  getBeliefs?: () => NarBelief[];
  getRevisionHistory?: (term: unknown) => RevisionEntry[];
  getLMClient?: () => {
    provider?: string;
    model?: string;
    available?: boolean;
    getStats?: () => unknown;
    getCatalog?: () => Array<{ id: string; available: boolean }>;
    selectProvider?: (provider: string, model?: string) => void;
  };
  getLMClientStats?: () => unknown;
  getSelfAnalyzer?: () => { start?: () => void; stop?: () => void } | undefined;
  clearMemory?: () => void;
  setConfig?: (updates: Record<string, unknown>) => void;
  attentionReport?: () => { total: number };
  getProcessor?: () => NarProcessorLike;
  getExecution?: () => { getSpendSummary?: () => SpendSummary };
  /** Kernel control plane (CORE.19 C2.2) — the UI drives the kernel, not a UI loop. */
  step?: (signal?: AbortSignal) => unknown;
  pause?: () => void;
  resume?: () => void;
  getControlState?: () => 'running' | 'paused' | 'stepping';
  getCycleCount?: () => number;
};

export const DEFAULT_RUN_CYCLES = 20;
export const ASK_RUN_CYCLES = 3;

export type TestState = {
  concepts: Array<{ term: string; f: number; c: number }>;
  chatHistory: Array<{ role: string; content: string }>;
  derivations: Array<{ conclusion: string; frequency: number; confidence: number }>;
  connected: boolean;
};

export const testState: TestState = {
  concepts: [],
  chatHistory: [],
  derivations: [],
  connected: false,
};

export function errorFrame(
  code: 'invalid_message' | 'not_available' | 'internal',
  message: string,
  context?: Record<string, unknown>
): IncomingFromServer {
  return { type: 'server.error', code, message, context };
}

export function sendStateSnapshot(
  ws: WebSocket,
  projection: { seq: number; graphSnapshot: () => { nodes: GraphNodeData[] } } | undefined,
  nar: () => NarLike | undefined,
  currentNarConfig: Record<string, unknown>
): void {
  if (!projection || ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: 'state.snapshot',
      seqId: projection.seq,
      data: {
        graph: projection.graphSnapshot(),
        workingMemory: nar()?.getBeliefs?.().map((b) => b.term.toString()) ?? [],
        config: buildConfigSchema(currentNarConfig),
      },
    })
  );
}

export function broadcastCognitiveEvent(
  event: CognitiveEvent,
  wss: { clients: Set<WebSocket> }
): void {
  const msg = JSON.stringify({ type: 'cognitive.events', events: [event] });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

/** Send the kernel control state as a `cycle.state` frame (CORE.19 C2.2). */
export function sendCycleState(ws: WebSocket, nar: () => NarLike | undefined): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const engine = nar();
  ws.send(
    JSON.stringify({
      type: 'cycle.state',
      state: engine?.getControlState?.() ?? 'running',
      cycleCount: engine?.getCycleCount?.(),
    } satisfies IncomingFromServer)
  );
}

export function sendNodeHistory(
  ws: WebSocket,
  term: string,
  nar: () => NarLike | undefined
): void {
  let history: RevisionEntry[] = [];
  try {
    history = nar()?.getRevisionHistory?.(termParser.parse(term)) ?? [];
  } catch {
    history = [];
  }
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: 'node.history',
      term,
      history: history.map(({ truth, stampId, timestamp, source }) => ({
        truth,
        stampId,
        timestamp,
        source,
      })),
    })
  );
}

const BROWSER_PROVIDERS = new Set(['webllm']);

export function providerCatalog(
  nar: () => NarLike | undefined,
  LM_PROVIDER_NAMES: readonly string[]
): Array<{ id: string; kind: 'browser' | 'engine'; available?: boolean }> {
  const availability = nar()?.getLMClient?.()?.getCatalog?.();
  return LM_PROVIDER_NAMES.map((id) => ({
    id,
    kind: BROWSER_PROVIDERS.has(id) ? 'browser' : 'engine',
    ...(availability
      ? { available: availability.find((entry) => entry.id === id)?.available ?? false }
      : {}),
  }));
}

export function sendLmStatus(
  ws: WebSocket,
  nar: () => NarLike | undefined,
  LM_PROVIDER_NAMES: readonly string[]
): void {
  const lm = nar()?.getLMClient?.() ?? {};
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: 'lm.status',
      data: {
        provider: lm.provider ?? 'none',
        model: lm.model,
        available: lm.available ?? false,
        stats: typeof lm.getStats === 'function' ? lm.getStats() : {},
        providers: providerCatalog(nar, LM_PROVIDER_NAMES),
      },
    })
  );
}

export function applyLmSwitch(
  ws: WebSocket,
  provider: string,
  model: string | undefined,
  nar: () => NarLike | undefined,
  LM_PROVIDER_NAMES: readonly string[]
): void {
  const known = LM_PROVIDER_NAMES.includes(provider as (typeof LM_PROVIDER_NAMES)[number]);
  if (!known) {
    ws.send(
      JSON.stringify(
        errorFrame('invalid_message', `Unknown LM provider "${provider}"`, {
          provider,
          providers: LM_PROVIDER_NAMES,
        })
      )
    );
    return;
  }
  const lm = nar()?.getLMClient?.();
  if (lm?.selectProvider) lm.selectProvider(provider, model);
  else nar()?.setConfig?.({ lm: { provider } });
  sendLmStatus(ws, nar, LM_PROVIDER_NAMES);
}

export function broadcastConfigSchema(
  wss: { clients: Set<WebSocket> },
  currentNarConfig: Record<string, unknown>
): void {
  const schema = buildConfigSchema(currentNarConfig);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'config.schema', data: schema }));
    }
  }
}

export function applyConfigUpdates(
  updates: Partial<Record<string, unknown>>,
  nar: () => NarLike | undefined,
  currentNarConfig: Record<string, unknown>,
  broadcastConfigSchemaFn: () => void
): void {
  const engine = nar();
  if (!engine?.setConfig) return;
  engine.setConfig(updates);
  Object.assign(currentNarConfig, updates);
  broadcastConfigSchemaFn();
}

export function respondReasoning(
  ws: WebSocket,
  ok: boolean,
  message: string | undefined,
  seqId: number | undefined,
  extra?: {
    answer?: {
      answer?: string;
      frequency?: number;
      confidence?: number;
      hasDerivation?: boolean;
    };
    termination?: Array<{ scope: string; reason: string }>;
  }
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const response: IncomingFromServer = {
    type: 'reasoning.control.response',
    ok,
    message,
    seqId,
    answer: extra?.answer,
    termination: extra?.termination,
  };
  ws.send(JSON.stringify(response));
}

export function runCycles(
  ws: WebSocket,
  cycles: number,
  seqId: number | undefined,
  nar: () => NarLike | undefined,
  activeRun: { current: AbortController | undefined },
  respondReasoningFn: (ws: WebSocket, ok: boolean, message?: string, seqId?: number, extra?: { termination?: Array<{ scope: string; reason: string }> }) => void,
  spendTerminationsFn: (summary: SpendSummary) => Array<{ scope: string; reason: string }>,
  mergeSpendSummariesFn: (a: SpendSummary, b: SpendSummary) => SpendSummary
): void {
  const engine = nar();
  const run = engine?.run;
  if (!run) {
    respondReasoningFn(ws, false, 'Engine cannot run cycles', seqId);
    return;
  }
  activeRun.current?.abort();
  const controller = new AbortController();
  activeRun.current = controller;

  let accumulatedSummary: SpendSummary = {};
  const runOne = async (): Promise<void> => {
    for (let i = 0; i < cycles; i++) {
      if (controller.signal.aborted) return;
      await run(1, controller.signal);
      const exec = engine.getExecution?.();
      const summary = exec?.getSpendSummary?.();
      if (summary) accumulatedSummary = mergeSpendSummariesFn(accumulatedSummary, summary);
    }
  };

  Promise.resolve(runOne())
    .then(() =>
      respondReasoningFn(ws, true, controller.signal.aborted ? 'aborted' : undefined, seqId, {
        termination: spendTerminationsFn(accumulatedSummary),
      })
    )
    .catch((e: unknown) => respondReasoningFn(ws, false, (e as Error).message, seqId))
    .finally(() => {
      if (activeRun.current === controller) activeRun.current = undefined;
    });
}

export function aggregateChatResponse(
  agent: { chat?: (text: string) => AsyncIterable<{ kind: string; text?: string }> } | undefined,
  text: string,
  ws: WebSocket | undefined
): Promise<string> {
  return (async () => {
    let response = '';
    if (typeof agent?.chat !== 'function') return response;
    for await (const evt of agent.chat(text)) {
      if (evt.kind !== 'text-delta' || !evt.text) continue;
      response += evt.text;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat.agent.stream', delta: evt.text }));
      }
    }
    return response;
  })();
}

export function clearTestState(): void {
  testState.concepts = [];
  testState.chatHistory = [];
  testState.derivations = [];
  testState.connected = false;
}