import type { CognitiveAction, CognitiveState } from '../cognitive';
import type { Ambiguity, TaskBatch } from '../nl';
import type { Term, Truth } from '../terms';

export interface EventMap {
  [key: string]: unknown;
}

export interface NAREventMap extends EventMap {
  'rule:applied': {
    ruleId: string;
    premises: [Term, Term];
    conclusion: Term;
    truth: Truth;
    duration: number;
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
    args: any;
    result: any;
    timestamp: number;
    duration: number;
    context?: any;
  };
  'tool:error': {
    type: string;
    name: string;
    args: any;
    result: any;
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
  'system:lm.rule:applied': { ruleId: string; ruleName: string; durationMs: number; output: string; timestamp: number };
  'system:lm.rule:skipped': { ruleId: string; ruleName: string; reason: string; timestamp: number };
  'system:lm.rule:structured': { ruleId: string; schema: string; output: string; timestamp: number };
  'system:lm.rule:tool:called': { ruleId: string; tool: string; args: Record<string, unknown>; timestamp: number };
  'system:lm.rule:tool:result': { ruleId: string; tool: string; result: unknown; timestamp: number };
  'system:lm.rule:failed': { ruleId: string; ruleName: string; error: string; durationMs: number; timestamp: number };
  'system:lm.rule:circuit:open': { ruleId: string; ruleName: string; timestamp: number };
  'system:lm.rule:circuit:half-open': { ruleId: string; ruleName: string; timestamp: number };
  'system:lm.rule:circuit:closed': { ruleId: string; ruleName: string; timestamp: number };
  }

export type EventReceiver<T> = (params: T) => void;
export type EventUnsubscribe = () => void;

/**
 * @deprecated Will be removed in next major version.
 * Use `import { EventBus } from '@senars/util'` instead.
 */
export { EventBus } from '@senars/util/events';
