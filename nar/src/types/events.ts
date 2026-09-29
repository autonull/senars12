import type { BudgetEventMap } from '@senars/core/budget';
import type { Term, Truth } from '../terms';

/**
 * Event channel taxonomy (B5).
 * All events are emitted on a single NarEventBus but logically grouped by channel prefix.
 * - kernel:*  — system-level: budget, memory, cycle, LM calls, concept lifecycle
 * - cognition:* — reasoning: derivations, drives, self-monitoring, LM rules
 * - ui:*      — user-facing: NL, conversation, tools, agent process
 * 
 * Existing event names are retained for parity; migration to prefixed names
 * will happen after golden scenarios are verified (C31).
 */
export const EventChannel = {
  kernel: 'kernel',
  cognition: 'cognition',
  ui: 'ui',
} as const;

export type ChannelPrefix = (typeof EventChannel)[keyof typeof EventChannel];

/** Helper to create a channel-scoped event name. */
export function channelEvent(prefix: ChannelPrefix, name: string): string {
  return `${prefix}:${name}`;
}

export interface Ambiguity {
  type: 'parse' | 'intent' | 'term' | 'reference';
  description: string;
  options: string[];
  confidence: number;
}

export interface Coreference {
  pronoun: string;
  antecedent: string;
  confidence: number;
}

export interface TaskBatch {
  beliefs: Array<{
    narsese: string;
    truth?: { f: number; c: number };
    source: 'user' | 'inferred';
    sourceText?: string;
  }>;
  questions: Array<{ narsese: string; context?: string; sourceText?: string }>;
  goals: Array<{ narsese: string; priority?: number; sourceText?: string }>;
  meta: {
    detectedIntent: 'chat' | 'command' | 'reasoning' | 'learning';
    ambiguities: Ambiguity[];
    coreferences: Coreference[];
    implicitContext: string[];
    driveModulations?: Record<string, number>;
  };
}

/** Cognitive state of the NAR (emitted on `cognitive:state-change`). */
export type CognitiveState = 'normal' | 'confused' | 'bored' | 'overloaded' | 'idle';
/** Recommended cognitive action for a given state. */
export type CognitiveAction =
  | 'continue'
  | 'resolve-conflicts'
  | 'explore'
  | 'consolidate'
  | 'suspend';

export interface EventMap {
  [key: string]: unknown;
}

/**
 * Phase C (REFACTOR.todo3 §10a M5): typed MeTTa/NAL disagreement — feeds the
 * SelfMetaGame resolution loop (replaces substring-only signal paths).
 */
export interface ContradictionEvent {
  source: 'metta' | 'nal';
  term: Term;
  mettaVote: boolean;
  nalVote: boolean;
  at: number;
}

export interface NAREventMap extends EventMap, BudgetEventMap {
  contradiction: ContradictionEvent;
  'rule:applied': {
    ruleId: string;
    premises: [Term, Term];
    conclusion: Term;
    truth: Truth;
    duration: number;
    cpuMs?: number;
    lmCalls?: number;
    lmTokens?: number;
  };
  'concept:created': { term: Term; priority: number };
  'concept:removed': { term: Term; reason: 'forgotten' | 'archived' | 'evicted' };
  'memory:pressure': { level: number; utilization: number };
  'memory:consolidated': { conceptsRemoved: number; conceptsArchived: number };
  'lm:call': { modelId: string; inputTokens: number; outputTokens: number; duration: number };
  'lm:error': { ruleId: string; error: Error; duration: number };
  'cycle:start': { cycle: number; conceptCount: number };
  'cycle:end': { cycle: number; derivations: number; duration: number };
  error: { error: Error; context?: Record<string, unknown> };
  // NL events (GROW2 §9.3)
  'nl:analyzed': { input: string; analysis: TaskBatch };
  'nl:translation': { nl: string; narsese: string; tier: number };
  'nl:clarification-needed': { ambiguity: Ambiguity };
  // NAL events
  'nal:derived': { premises: string[]; rule: string; conclusion: string; truth: Truth };
  // LM validation events
  'lm:validation-failed': { output: string; reason: string };
  // Cognitive events
  'cognitive:state-change': {
    oldState: CognitiveState;
    newState: CognitiveState;
    action: CognitiveAction;
  };
  // Feedback events
  'feedback:correction': { original: string; corrected: string };
  // Pipeline events (from PipelineEvents)
  'turn:start': { input: unknown; passCount: number };
  'turn:end': { response: unknown; durationMs: number };
  'turn:error': { error: Error; stage: string; passCount: number };
  'stage:start': { stage: string; passCount: number };
  'stage:end': { stage: string; durationMs: number; passCount: number };
  'stage:error': { stage: string; error: Error; durationMs: number };
  'classify:result': { input: string; classification: unknown };
  'trigger:score': { heuristicScore: number; lmScore: number; total: number; activated: boolean };
  'reasoning:start': { inputType: string; steps: number };
  'reasoning:end': { steps: number; newBeliefs: unknown[] };
  'lm:start': { promptLength: number; streaming: boolean };
  'lm:chunk': { content: string; accumulated: string };
  'lm:end': { response: string; durationMs: number };
  'lm:suggests-reasoning': boolean;
  'lm-rule:executed': { ruleId: string; durationMs: number; tasksGenerated: number };
  'lm-rule:failed': { ruleId: string; error: string; durationMs: number };
  'lm-rule:disabled': { ruleId: string };
  'directive:found': { directive: unknown };
  'directive:execute': { directive: unknown; success: boolean; result?: unknown; error?: string };
  'directive:loop-requested': { type: string };
  'loop:pass': { passCount: number; needsLoopBack: boolean };
  // Tool events
  'tool:register': { name: string; descriptor: unknown };
  'tool:unregister': { name: string };
  'tool:init': { name: string; state: string };
  'tool:stop': { name: string; state: string };
  'tool:dispose': { name: string; state: string };
  'tool:call': { type: string; name: string; args: unknown; timestamp: number; context?: unknown };
  'tool:result': {
    type: string;
    name: string;
    args?: any;
    result?: any;
    timestamp: number;
    duration: number;
    context?: any;
  };
  'tool:error': {
    type: string;
    name: string;
    args?: any;
    result?: any;
    timestamp: number;
    duration: number;
    context?: any;
  };
  // Conversation events
  'conversation:message-added': { message: any; count: number };
  'conversation:artifact-added': { artifact: any; count: number };
  'conversation:belief-pinned': { belief: string; count: number };
  'conversation:summarized': { summary: string };
  // Agent process events (formerly cognition events)
  'agent:process:start': { input: string; context?: any };
  'agent:process:complete': { result: any; durationMs: number };
  'agent:suspend': { cycleCount: number; lastActivity: number };
  'agent:resume': { cycleCount: number; lastActivity: number };
  // System LM rule events
  'system:lm.rule:applied': {
    ruleId: string;
    ruleName: string;
    durationMs: number;
    output: string;
    timestamp: number;
  };
  'system:lm.rule:skipped': { ruleId: string; ruleName: string; reason: string; timestamp: number };
  'system:lm.rule:structured': {
    ruleId: string;
    schema: string;
    output: string;
    timestamp: number;
  };
  'system:lm.rule:tool:called': {
    ruleId: string;
    tool: string;
    args: Record<string, unknown>;
    timestamp: number;
  };
  'system:lm.rule:tool:result': {
    ruleId: string;
    tool: string;
    result: unknown;
    timestamp: number;
  };
  'system:lm.rule:failed': {
    ruleId: string;
    ruleName: string;
    error: string;
    durationMs: number;
    timestamp: number;
  };
  'system:lm.rule:circuit:open': { ruleId: string; ruleName: string; timestamp: number };
  'system:lm.rule:circuit:half-open': { ruleId: string; ruleName: string; timestamp: number };
  'system:lm.rule:circuit:closed': { ruleId: string; ruleName: string; timestamp: number };
  // Budget slice events (B4)
}

export type EventReceiver<T> = (params: T) => void;
export type EventUnsubscribe = () => void;

/**
 * @deprecated Will be removed in next major version.
 * Use `import { EventBus } from '@senars/util'` instead.
 */
import { EventBus } from '@senars/util/events';

export { EventBus };

/** NAR's event bus, keyed on {@link NAREventMap} (X4: typed bus). */
export class NarEventBus extends EventBus<NAREventMap> {}

/** Scoped emitter for a specific channel (e.g., per-game, per-component). */
export class ScopedEventEmitter {
  constructor(
    private readonly bus: NarEventBus,
    private readonly prefix: string
  ) {}

  emit<K extends string & keyof NAREventMap>(eventName: K, params: NAREventMap[K]): void {
    this.bus.emit(`${this.prefix}:${eventName}` as K, params);
  }

  on<K extends string & keyof NAREventMap>(eventName: K, fn: (params: NAREventMap[K]) => void): () => void {
    return this.bus.on(`${this.prefix}:${eventName}` as K, fn);
  }

  once<K extends string & keyof NAREventMap>(eventName: K, fn: (params: NAREventMap[K]) => void): () => void {
    return this.bus.once(`${this.prefix}:${eventName}` as K, fn);
  }
}
