import type {Task} from '../nar/types';

export interface RLFPState {
  enabled: boolean;
  policy: Record<string, number>;
  qValues: Record<string, number>;
  explorationRate: number;
  totalRewards: number;
  totalSteps: number;
}

export interface SelfReasoningState {
  qualityScore: number;
  consistency: number;
  gaps: string[];
  suggestions: string[];
}

export interface QualityMetrics {
  overall: number;
  coherence: number;
  relevance: number;
  completeness: number;
}

export interface GoalProgress {
  goalId: string;
  term: string;
  progress: number;
  status: 'active' | 'completed' | 'failed' | 'paused';
  subgoals: GoalProgress[];
  startedAt: number;
  updatedAt: number;
}

export interface ExplanationChain {
  conclusion: string;
  premises: ExplanationChain[];
  rule: string;
  confidence: number;
}

export interface RuleTrace {
  ruleId: string;
  ruleName: string;
  input: {primary: string; secondary?: string};
  output: {tasks: string[]; durationMs: number};
  timestamp: number;
}

export interface LMRuleStats {
  id: string;
  name: string;
  enabled: boolean;
  stats: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalDuration: number;
    totalTokens: number;
    averageDuration: number;
    successRate: number;
    totalCost: number;
    averageCost: number;
  };
  circuitState: 'closed' | 'open' | 'half-open';
}

export interface LMRuleExecutionEntry {
  ruleName: string;
  status: 'fired' | 'skipped' | 'timeout' | 'aborted';
  durationMs: number;
  tasksProduced: number;
  timestamp: number;
}

export interface ChatOpts {
  historyLimit?: number;
  signal?: AbortSignal;
}

export type StreamEvent =
  | {kind: 'text-delta'; text: string}
  | {kind: 'tool-call'; toolName: string; toolArgs: Record<string, unknown>}
  | {kind: 'tool-result'; toolName: string; toolArgs: Record<string, unknown>; toolResult: unknown}
  | {kind: 'finish'; text: string}
  | {kind: 'aborted'}
  | {kind: 'error'; error: string}
  | {kind: 'clarify'; text: string}
  | {kind: 'lm-rule-applied'; ruleId: string; ruleName: string; tasksProduced: number};

export interface EventMap {
  'agent:process:start': {input: string; sessionKey?: string; timestamp: number};
  'agent:process:complete': {input: string; output: string; durationMs: number; sessionKey?: string; tokens?: {input: number; output: number; total: number}; timestamp: number};
  'agent:process:error': {input: string; error: string; sessionKey?: string; timestamp: number};
  'agent:suspend': {timestamp: number};
  'agent:resume': {timestamp: number};
}

export interface DerivationEntry {
  term: string;
  truth?: {f: number; c: number};
  timestamp: number;
}

export interface NARState {
  beliefs: Task[];
  goals: Task[];
  questions: Task[];
  attention: {totalConcepts: number; pressure: number};
  drives: Record<string, number>;
}

export interface SessionSnapshot {
  key: string;
  history: Array<{role: 'user' | 'assistant'; content: string; timestamp: number}>;
  pinnedBeliefs: string[];
  createdAt: number;
  updatedAt: number;
}