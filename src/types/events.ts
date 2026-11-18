import type { BudgetEventMap } from '@senars/core/budget';
import type { AmbiguityReport, DerivationRecord, DerivationStep, KernelControlState } from '@senars/core/schemas';
import type { TermTruth } from '@senars/util';
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

/** An ambiguity an LM reported: *what* was ambiguous, not what it costs. The kernel's
 *  `AmbiguityReport`, whose severity is derived from the kind rather than supplied. */
export type Ambiguity = AmbiguityReport;

export interface Coreference {
  pronoun: string;
  antecedent: string;
  confidence: number;
}

export interface TaskBatch {
  beliefs: Array<{
    narsese: string;
    truth?: TermTruth;
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

/**
 * What a tool call reported back. `tool:result` and `tool:error` were the same
 * record with a different name — the outcome lives in `result` either way — so
 * they are one payload rather than two spellings of one that could drift.
 */
interface ToolOutcome {
  type: string;
  name: string;
  args?: any;
  result?: any;
  timestamp: number;
  duration: number;
  context?: any;
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
    /** The kernel cycle the rule fired in — joins the fire to its `cycle:state`. */
    cycle?: number;
  };
  'concept:created': { term: Term; priority: number };
  'concept:removed': { term: Term; reason: 'forgotten' | 'archived' | 'evicted' | 'retracted' };
  /**
   * One admitted rule fire, in the schema's own shape (CORE.19 C1.3). The
   * `derivation.accepted` cognitive event the bridge mints from it is the
   * durable, provenance-carrying form; `rule:applied` is the live ping. Carries
   * no wall-clock: the durable append re-stamps, and a `Date.now()` here would
   * break the seeded trace (D13).
   */
  'derivation:accepted': Omit<DerivationStep, 'timestamp'>;
  /**
   * A completed derivation chain (CORE.19 C3.4), emitted by the kernel when a
   * record closes rather than drained by a consumer. The bridge mints the durable
   * `derivation.record` from it; the record's timestamps come from the injected
   * clock, so a seeded trace stays byte-identical (D13).
   */
  'derivation:record': DerivationRecord;
  /**
   * A new belief/goal/question was admitted (a first sighting), the coarse
   * liveness ping the proactive-notification path listens for. Emitted on the one
   * NAR bus; it has no `CognitiveEvent` counterpart, because it announces an
   * admission the durable `task.admitted`/`concept.activated`/`derivation.accepted`
   * events already carry with provenance (D15 — a live signal, not a second log).
   */
  'nar:derivation': { term: string; confidence: number; timestamp: number };
  'memory:pressure': { level: number; utilization: number };
  'memory:consolidated': { conceptsRemoved: number; conceptsArchived: number };
  'lm:call': { modelId: string; inputTokens: number; outputTokens: number; duration: number };
  'lm:error': { ruleId: string; error: Error; duration: number };
  /**
   * The kernel heartbeat (CORE.19 M0/C1): the control-plane state after every
   * cycle. Replaces the unproduced `cycle:start`/`cycle:end` pair — one event
   * with a real producer and a consumer.
   */
  'cycle:state': {
    state: KernelControlState;
    cycle: number;
    phase: string;
    activeTasks: number;
    budget: Record<string, number>;
    derived: number;
  };
  error: { error: Error; context?: Record<string, unknown> };
  /**
   * A restart resumed the declared persistence boundary (CORE.19 C4.6) — the
   * durable, observable form of the resumption, bridged to `restored`.
   */
  'restore:state': { cycleCount: number; concepts: number; pendingTasks: number };
  /**
   * A rewind restored the nearest checkpoint (CORE.19 C2.3). Live-only on the
   * bus, like the autonomy and explanation events: the payload is the kernel's
   * own report, and a cognitive variant would force the UI catalog to name one
   * (halt list).
   */
  'cycle:rewound': {
    from: number;
    target: number;
    restored: number;
    checkpointed: boolean;
    concepts: number;
    gaps: string[];
  };
  /**
   * The autonomy heartbeat minted an internal question about a concept it is
   * uncertain of (CORE.19 C5.4). The question itself admits through the gate as
   * a `task.admitted`, so this is the *cause*, with the provenance the task
   * event cannot carry.
   */
  'autonomy:curiosity': {
    policy: 'curiosity';
    trigger: string;
    concept: string;
    question: string;
    cycle: number;
  };
  /** The autonomy heartbeat ran a consolidation pass and reports the delta (CORE.19 C5.5). */
  'autonomy:consolidated': {
    policy: 'consolidation';
    trigger: string;
    conceptsBefore: number;
    conceptsAfter: number;
    archived: number;
    forgotten: number;
    /** Whether a pre-pass checkpoint was captured, so a caller can `recoverConsolidation`. */
    checkpointed: boolean;
    cycle: number;
  };
  /** The heartbeat halted because an idle-window budget was spent (CORE.19 C5.1). */
  'autonomy:budget': {
    reason: string;
    cycle: number;
    cyclesInWindow: number;
    wallClockMs: number;
  };
  // NL events (GROW2 §9.3)
  'nl:analyzed': { input: string; analysis: TaskBatch };
  'nl:translation': { nl: string; narsese: string; tier: number };
  'nl:clarification-needed': { ambiguity: Ambiguity };
  /**
   * The kernel explained a derivation from its own rule-fire records (CORE.19
   * C6.4). Live-only on the bus, like the autonomy events: the payload is the
   * engine's own facts, and minting a cognitive variant would force the UI
   * catalog to name one (halt list). The cited `derivationIds` join the durable
   * `derivation.accepted` events, which already carry the same provenance.
   */
  explanation: {
    conclusion: string;
    derivationIds: string[];
    rules: string[];
    steps: number;
    paraphrased: boolean;
    /** True when the explanation is a conflict between two contradicted beliefs (C6.5). */
    conflict?: boolean;
  };
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
  'tool:result': ToolOutcome;
  'tool:error': ToolOutcome;
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

export type { EventReceiver, EventUnsubscribe } from '@senars/util/events';

import { EventBus } from '@senars/util/events';

/** NAR's event bus, keyed on {@link NAREventMap} (X4: typed bus). */
export class NarEventBus extends EventBus<NAREventMap> {}
