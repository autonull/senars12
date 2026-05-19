import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {Connection} from '../io/types.js';
import type {BotProfile} from './BotProfile.js';
import type {ChannelType} from './ChannelBehavior.js';
import {TaskFormatter} from '../nar/utils/task-formatter.js';

export type BotMode = 'auto' | 'chat' | 'reason';
export type Intent = 'chat' | 'reason' | 'query' | 'goal' | 'command' | 'narsese';

// Pipeline Events
export interface PipelineEvents {
  // Lifecycle
  'turn:start': { input: IOMessage; passCount: number };
  'turn:end': { response: BotResponse; durationMs: number };
  'turn:error': { error: Error; stage: string; passCount: number };

  // Stage lifecycle
  'stage:start': { stage: string; passCount: number };
  'stage:end': { stage: string; durationMs: number; passCount: number };
  'stage:error': { stage: string; error: Error; durationMs: number };

  // Classification
  'classify:result': { input: string; classification: InputClassification };

  // Reasoning
  'trigger:score': { heuristicScore: number; lmScore: number; total: number; activated: boolean };
  'reasoning:start': { inputType: string; steps: number };
  'reasoning:end': { steps: number; newBeliefs: Belief[] };

  // LM
  'lm:start': { promptLength: number; streaming: boolean };
  'lm:chunk': { content: string; accumulated: string };
  'lm:end': { response: string; durationMs: number };
  'lm:suggests-reasoning': boolean;

  // LM Rules
  'lm-rule:executed': { ruleId: string; durationMs: number; tasksGenerated: number };
  'lm-rule:failed': { ruleId: string; error: string; durationMs: number };
  'lm-rule:disabled': { ruleId: string };

  // Directives
  'directive:found': { directive: LMDirective };
  'directive:execute': { directive: LMDirective; success: boolean; result?: unknown; error?: string };
  'directive:loop-requested': { type: string };

  // Loop
  'loop:pass': { passCount: number; needsLoopBack: boolean };
}

// Event Bus
type EventCallback<T> = (data: T) => void;

export class PipelineEventEmitter {
  private listeners = new Map<string, Set<EventCallback<unknown>>>();

  on<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as EventCallback<unknown>);
  }

  off<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void {
    this.listeners.get(event)?.delete(cb as EventCallback<unknown>);
  }

  emit<K extends keyof PipelineEvents>(event: K, data: PipelineEvents[K]): void {
    for (const cb of this.listeners.get(event) ?? []) cb(data);
  }

  once<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void {
    const wrapper: EventCallback<unknown> = (data) => { cb(data as PipelineEvents[K]); this.off(event, wrapper); };
    this.on(event, wrapper);
  }
}

// Configuration Types
export interface BotConfig {
  reasoning: {
    autoTrigger: boolean;
    triggerThreshold: number;
    triggerCooldown: number;
    maxStepsPerTrigger: number;
    backgroundReasoning: boolean;
    backgroundIntervalMs: number;
    lmDriven: boolean;
  };
  streaming: {
    enabled: boolean;
    showReasoningSteps: boolean;
    showToolCalls: boolean;
  };
  conversation: {
    maxHistory: number;
    summaryThreshold: number;
    maxArtifacts: number;
  };
  pipeline: {
    maxLoops: number;
    stageTimeoutMs: number;
    enableLoopBack: boolean;
    loopBackOn: ('believe' | 'question' | 'tool_call')[];
    stages?: any[];
    preset?: 'default' | 'chat' | 'reasoning' | 'tool';
  };
  directives: {
    builtIn: boolean;
    custom?: DirectiveDef[];
  };
  nlParsers: {
    builtIn: boolean;
    custom?: NLParserDef[];
  };
  classifier: {
    signals?: ClassificationSignalDef[];
    modeWeight?: number;
  };
  lmRules: {
    enabled: boolean;
    rules: LMRuleConfigEntry[];
    custom?: LMRuleDef[];
  };
  prompts: {
    system?: string;
    directiveInstructions?: string;
    responseGuidelines?: string;
  };
  tui: {
    typingIndicator: boolean;
    colors: boolean;
    compactMode: boolean;
    statusBar: boolean;
  };
}

// Pluggable Types
export interface NLParserDef {
  name: string;
  match: (text: string) => boolean;
  translate: (text: string) => string | null;
}

export interface DirectiveDef {
  pattern: RegExp;
  type: string;
  extract: (match: RegExpMatchArray) => { name?: string; content: string };
  execute: (nar: NAR, content: string, name?: string) => Promise<unknown>;
  triggersLoopBack: boolean;
}

export interface ClassificationSignalDef {
  type: 'keyword' | 'pattern' | 'structure' | 'narsese';
  pattern: RegExp;
  intent: Intent;
  weight: number;
}

export interface LMRuleConfigEntry {
  id: string;
  enabled: boolean;
  priority?: number;
  instruction?: string;
  context?: (keyof typeof contextFragments | ContextFragment)[];
  maxCallsPerTurn?: number;
  budget?: number;
}

export interface LMRuleDef {
  id: string;
  context: (keyof typeof contextFragments | ContextFragment)[];
  instruction: string;
  prompt?: string;
}

export type ContextFragment = (nar: NAR, ctx?: BotContext) => string;

// Context Fragments
export const contextFragments = {
  attention: (nar: NAR) => {
    const r = nar.attentionReport();
    return r.concepts.length ? `Active: ${r.concepts.slice(0, 10).map(c => `${c.term} (${(c.priority * 100).toFixed(0)}%)`).join(', ')}` : '';
  },
  relatedBeliefs: (term: string) => (nar: NAR) => {
    const beliefs = nar.getBeliefs();
    const b = beliefs.filter(bel => bel.term.toString().includes(term.split(' ')[0] ?? ''));
    return b.length ? `Related: ${b.slice(0, 5).map(bel => `${bel.term} :${bel.truth ? TaskFormatter.formatTruth(bel.truth) : '0.50:0.80'}`).join('; ')}` : '';
  },
  links: (term: string) => (nar: NAR) => {
    const beliefs = nar.getBeliefs();
    const target = beliefs.find(b => b.term.toString().includes(term.split(' ')[0] ?? ''));
    if (!target) return '';
    const concept = nar.getConcept?.(target.term);
    const links = concept?.getLinks?.() ?? [];
    return links.length ? `Links: ${links.slice(0, 5).map(l => `${l.concept.term}(${(l.strength * 100).toFixed(0)}%)`).join(', ')}` : '';
  },
  goals: (nar: NAR) => {
    const g = nar.getGoals();
    return g.length ? `Goals: ${g.slice(0, 3).map(g => g.term).join('; ')}` : '';
  },
  questions: (nar: NAR) => {
    const q = nar.getQuestions();
    return q.length ? `Questions: ${q.slice(0, 3).map(q => q.term).join('; ')}` : '';
  },
  recentDerivations: (_nar: NAR, ctx?: BotContext) => {
    const r = ctx?.turn?.reasoningResult?.newBeliefs;
    return r?.length ? `Derived: ${r.slice(0, 3).map(b => b.term).join('; ')}` : '';
  },
  memoryHealth: (nar: NAR) => {
    const s = nar.getStatistics();
    return `Memory: ${s.totalConcepts} concepts, pressure ${(s.memoryPressure * 100).toFixed(0)}%`;
  },
  focus: (nar: NAR) => {
    const report = nar.attentionReport();
    return report.concepts.length ? `Focus: ${report.concepts.slice(0, 5).map(c => `${c.term}(${(c.priority * 100).toFixed(0)}%)`).join(', ')}` : '';
  },
  workingMemory: (_nar: NAR, ctx?: BotContext) => {
    const pinned = ctx?.conversation.getPinned() ?? [];
    return pinned.length ? `Pinned: ${pinned.join('; ')}` : '';
  },
};

// TurnState with loop-back support
export interface TurnState {
  input: IOMessage;
  classification: InputClassification;
  reasoningTriggered: boolean;
  reasoningResult?: DerivationResult;
  queryAnswer?: string;
  lmResponse?: string;
  lmSuggestsReasoning: boolean;
  directives: LMDirective[];
  directiveResults: DirectiveResult[];
  toolResults: ToolResult[];
  commandResponses: string[];
  actions: TurnAction[];
  finalResponse: string;
  error?: Error;
  passCount: number;
  needsLoopBack: boolean;
  loopBackType?: string;
  reasoningDepthOverride?: number;
}

export interface DerivationResult {
  steps: number;
  beliefs: Belief[];
  newBeliefs: Belief[];
}

export interface Belief {
  term: string;
  truth?: { frequency: number; confidence: number };
}

export interface LMDirective {
  type: 'believe' | 'question' | 'tool_call' | 'reasoning_depth' | string;
  name: string;
  content: string;
  raw: string;
  _def?: DirectiveDef;
}

export interface DirectiveResult {
  directive: LMDirective;
  success: boolean;
  result?: unknown;
  error?: string;
  derivationSteps?: number;
}

export interface TurnAction {
  type: 'believe' | 'question' | 'goal' | 'tool_call';
  content: string;
  result?: string;
}

export interface ToolResult {
  name: string;
  result?: unknown;
  error?: string;
}

export interface TurnMetrics {
  startTime: number;
  stages: Map<string, { durationMs: number; error?: string }>;
}

export interface IOMessage {
  id: string;
  source: string;
  sender: string;
  text: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationState {
  messages: Message[];
  summary?: string;
  workingMemory: Map<string, unknown>;
  reasoningArtifacts: ReasoningArtifact[];
  pinnedBeliefs: Set<string>;
  lastClassification?: InputClassification;
  mode: BotMode;
  addMessage(msg: Message, lm?: LMClient): void;
  getHistory(limit?: number): Message[];
  getContextForLM(maxConcepts: number, nar: NAR): string;
  set(key: string, value: unknown): void;
  get<T>(key: string): T | undefined;
  addArtifact(artifact: ReasoningArtifact): void;
  getRecentArtifacts(limit?: number): ReasoningArtifact[];
  pin(belief: string): void;
  unpin(belief: string): void;
  getPinned(): string[];
}

export interface ReasoningArtifact {
  type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface InputClassification {
  primary: Intent;
  secondary?: Intent;
  confidence: number;
  signals: ClassificationSignal[];
  narseseTerms?: string[];
}

export interface ClassificationSignal {
  type: 'keyword' | 'pattern' | 'structure' | 'lm-suggestion' | 'narsese';
  source: string;
  intent: Intent;
  weight: number;
}

export interface BotResponse {
  text: string;
  reasoning?: DerivationResult;
  actions: TurnAction[];
  metrics?: TurnMetrics;
}

export interface Capabilities {
  hasLM: boolean;
  hasSeNARS: boolean;
  hasStreaming: boolean;
  hasTools: boolean;
  hasMemory: boolean;
  mode: 'full' | 'lm-only' | 'senars-only';
}

export interface ConnectionInfo {
  id: string;
  type: ChannelType;
  sender: string;
  respond: (text: string | StreamChunk) => Promise<void>;
  stream: (stream: AsyncIterable<StreamChunk>) => Promise<void>;
}

export interface StreamChunk {
  type: 'text' | 'reasoning' | 'tool' | 'error' | 'status';
  content: string;
  done: boolean;
  metadata?: Record<string, unknown>;
}

export interface BotContext {
  profile: BotProfile;
  lm?: LMClient;
  seNARS?: NAR;
  connection: ConnectionInfo;
  conversation: ConversationState;
  turn: TurnState;
  config: BotConfig;
  capabilities: Capabilities;
  metrics: TurnMetrics;
  events: PipelineEventEmitter;
}

export function detectCapabilities(lm?: LMClient, seNARS?: NAR): Capabilities {
  const hasLM = !!lm && lm.available !== false;
  const hasSeNARS = !!seNARS;
  const mode = hasLM && hasSeNARS ? 'full'
    : hasLM ? 'lm-only'
    : hasSeNARS ? 'senars-only'
    : (() => { throw new Error('At least one capability required'); })();

  return {
    hasLM,
    hasSeNARS,
    hasStreaming: hasLM && lm!.provider !== undefined,
    hasTools: hasSeNARS && seNARS!.tools !== undefined && seNARS!.tools.list().length > 0,
    hasMemory: hasSeNARS && !!seNARS!.memory,
    mode,
  };
}
