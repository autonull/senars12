import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {Connection} from '../io/types.js';
import type {BotProfile} from './BotProfile.js';
import type {ChannelType} from './ChannelBehavior.js';
import type {NLAnalysis, Ambiguity} from '../nar/nl/analyzer.js';
import {TaskFormatter} from '../nar/utils/task-formatter.js';
import type {EventBus} from '../nar/types/events.js';
import type {BotConfig, DirectiveDef, ContextFragment} from './config.js';

export type BotMode = 'auto' | 'chat' | 'reason';
export type Intent = 'chat' | 'reason' | 'query' | 'goal' | 'command' | 'narsese';

// Re-export EventBus for backward compatibility
export {EventBus as PipelineEventEmitter} from '../nar/types/events.js';
export type {EventBus as PipelineEventEmitterType} from '../nar/types/events.js';

// Re-export config types for backward compatibility
export type {
  BotConfig,
  NLParserDef,
  DirectiveDef,
  ClassificationSignalDef,
  LMRuleConfigEntry,
  LMRuleDef,
  ContextFragment,
} from './config.js';

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
  recentDerivations: (_nar: NAR, ctx?: unknown) => {
    const r = (ctx as any)?.turn?.reasoningResult?.newBeliefs;
    return r?.length ? `Derived: ${r.slice(0, 3).map((b: any) => b.term).join('; ')}` : '';
  },
  memoryHealth: (nar: NAR) => {
    const s = nar.getStatistics();
    return `Memory: ${s.totalConcepts} concepts, pressure ${(s.memoryPressure * 100).toFixed(0)}%`;
  },
  focus: (nar: NAR) => {
    const report = nar.attentionReport();
    return report.concepts.length ? `Focus: ${report.concepts.slice(0, 5).map(c => `${c.term}(${(c.priority * 100).toFixed(0)}%)`).join(', ')}` : '';
  },
  workingMemory: (_nar: NAR, ctx?: unknown) => {
    const pinned = (ctx as any)?.conversation?.getPinned() ?? [];
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
  nlAnalysis?: NLAnalysis;
}

export interface DerivationResult {
  steps: number;
  beliefs: Belief[];
  newBeliefs: Belief[];
  trace?: unknown[];
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
  canonicalId?: string;
  authId?: string;
  nick?: string;
  username?: string;
  hostmask?: string;
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
  events: EventBus;
}

export const detectCapabilities = (lm?: LMClient, seNARS?: NAR): Capabilities => {
  const hasLM = !!lm && lm.available !== false;
  const hasSeNARS = !!seNARS;
  if (!hasLM && !hasSeNARS) throw new Error('At least one capability required');

  return {
    hasLM, hasSeNARS,
    hasStreaming: hasLM && lm!.provider !== undefined,
    hasTools: hasSeNARS && seNARS!.tools !== undefined && seNARS!.tools.list().length > 0,
    hasMemory: hasSeNARS && !!seNARS!.memory,
    mode: hasLM && hasSeNARS ? 'full' : hasLM ? 'lm-only' : 'senars-only',
  };
};
