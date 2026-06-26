import type {Term, Truth} from '../terms';
import type {TaskBatch, Ambiguity} from '../nl/understanding.js';
import type {CognitiveState, CognitiveAction} from '../cognitive/ObserverService.js';

export interface EventMap {
    [key: string]: unknown;
}

export interface NAREventMap extends EventMap {
  'rule:applied': { ruleId: string; premises: [Term, Term]; conclusion: Term; truth: Truth; duration: number };
  'concept:created': { term: Term; priority: number };
  'concept:removed': { term: Term; reason: 'forgotten' | 'archived' | 'evicted' };
  'memory:pressure': { level: number; utilization: number };
  'memory:consolidated': { conceptsRemoved: number; conceptsArchived: number };
  'lm:call': { modelId: string; inputTokens: number; outputTokens: number; duration: number };
  'lm:error': { ruleId: string; error: Error; duration: number };
  'cycle:start': { cycle: number; conceptCount: number };
  'cycle:end': { cycle: number; derivations: number; duration: number };
  'error': { error: Error; context?: Record<string, unknown> };
  // NL events (GROW2 §9.3)
  'nl:analyzed': { input: string; analysis: TaskBatch };
  'nl:translation': { nl: string; narsese: string; tier: number };
  'nl:clarification-needed': { ambiguity: Ambiguity };
  // NAL events
  'nal:derived': { premises: string[]; rule: string; conclusion: string; truth: Truth };
  // LM validation events
  'lm:validation-failed': { output: string; reason: string };
  // Cognitive events
  'cognitive:state-change': { oldState: CognitiveState; newState: CognitiveState; action: CognitiveAction };
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
  'tool:result': { type: string; name: string; args: any; result: any; timestamp: number; duration: number; context?: any };
  'tool:error': { type: string; name: string; args: any; result: any; timestamp: number; duration: number; context?: any };
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
}

export type EventReceiver<T> = (params: T) => void;
export type EventUnsubscribe = () => void;

interface Listener<T = unknown> {
    fn: EventReceiver<T>;
    once: boolean;
}

export class EventBus<T extends EventMap = NAREventMap> {
    private listeners = new Map<string, Listener[]>();

    on<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe {
        const listeners = this.listeners.get(eventName as string) ?? [];
        listeners.push({fn: fn as unknown as EventReceiver<unknown>, once: false});
        this.listeners.set(eventName as string, listeners);
        return () => this.off(eventName as string, fn as EventReceiver<unknown>);
    }

    once<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe {
        const listeners = this.listeners.get(eventName as string) ?? [];
        listeners.push({fn: fn as unknown as EventReceiver<unknown>, once: true});
        this.listeners.set(eventName as string, listeners);
        return () => this.off(eventName as string, fn as EventReceiver<unknown>);
    }

    off(eventName: string, fn: EventReceiver<unknown>): void {
        const listeners = this.listeners.get(eventName);
        if (!listeners) return;
        const filtered = listeners.filter(l => l.fn !== fn);
        if (filtered.length === 0) {
            this.listeners.delete(eventName);
        } else {
            this.listeners.set(eventName, filtered);
        }
    }

    emit<K extends keyof T>(eventName: K & string, params: T[K]): void {
        const listeners = this.listeners.get(eventName as string);
        if (!listeners) return;

        for (const listener of listeners) {
            try {
                listener.fn(params);
            } catch (error) {
                console.error(`Event listener error for ${eventName}:`, error);
            }
        }

        const remaining = listeners.filter(l => !l.once);
        if (remaining.length === 0) {
            this.listeners.delete(eventName as string);
        } else {
            this.listeners.set(eventName as string, remaining);
        }
    }

    clear(): void {
        this.listeners.clear();
    }

    listenerCount(eventName: string): number {
        return this.listeners.get(eventName)?.length ?? 0;
    }
}


