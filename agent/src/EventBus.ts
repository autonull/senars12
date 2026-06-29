import {EventEmitter} from 'node:events';
import type {EventBus as NarEventBus} from '../../nar/src/types';

export interface AgentEventPayloads {
    'agent:process:start': { input: string; sessionKey?: string; timestamp: number };
    'agent:process:complete': {
        input: string;
        output: string;
        sessionKey?: string;
        durationMs: number;
        tokens?: { input: number; output: number; total: number };
        timestamp: number;
    };
    'agent:process:error': { input: string; sessionKey?: string; error: string; timestamp: number };
    'agent:suspend': { timestamp: number };
    'agent:resume': { timestamp: number };
    'agent:input': { input: string; timestamp: number };
    'agent:reply': { reply: string; durationMs: number; timestamp: number };
    'agent:error': { error: string; context?: unknown; timestamp: number };
}

export interface NarEventPayloads {
    'nar:derivation': { term: string; confidence: number; timestamp: number };
    'nar:concept:activated': { term: string; priority: number; timestamp: number };
    'nar:goal:resolved': { term: string; timestamp: number };
    'nar:conflict:detected': { term: string; conflictWith: string; timestamp: number };
    'nar:task:added': { term: string; type: string; timestamp: number };
    'nar:drive:changed': { drive: string; urgency: number; timestamp: number };
    'nar:reasoning:cycle': {
        cycle: number;
        derived: number;
        strategyPriority: string | null;
        effectiveSteps: number;
        timestamp: number;
    };
}

export interface SystemEventPayloads {
    'system:lm.rule:applied': {
        ruleId: string;
        ruleName: string;
        primaryTerm: string;
        secondaryTerm?: string;
        tasksProduced: number;
        durationMs: number;
        timestamp: number;
        schema?: string;
    };
    'system:lm.rule:skipped': {
        ruleId: string;
        ruleName: string;
        reason: 'circuit_open' | 'disabled' | 'activation_failed' | 'single_premise_missing';
        timestamp: number;
    };
    'system:lm.rule:structured': {
        ruleId: string;
        schema: string;
        output: unknown;
        timestamp: number;
    };
    'system:lm.rule:constitution-violation': {
        ruleId: string;
        term: string;
        clause: string;
        timestamp: number;
    };
}

export interface LoopEventPayloads {
    perception: {
        source: 'startup' | 'scheduled' | 'external' | 'interrupt';
        input?: string;
        timestamp: number;
        priority?: number;
    };
    reasoning: { context: string; timestamp: number };
    action: {
        actions: Array<{ tool: string; parameters: Record<string, unknown>; id: string }>;
        timestamp: number;
    };
    reflection: {
        actions: Array<{ tool: string; parameters: Record<string, unknown>; id: string }>;
        results: Array<{
            tool: string;
            success: boolean;
            result?: unknown;
            error?: string;
            id: string;
        }>;
        timestamp: number;
    };
}

export type EventMap = AgentEventPayloads &
    NarEventPayloads &
    SystemEventPayloads &
    LoopEventPayloads;
export type EventKey = keyof EventMap;

type EventHandler<T> = (data: T) => void;

export class EventBus {
    private readonly emitter = new EventEmitter();
    private readonly narUnsubscribers: Array<() => void> = [];

    constructor() {
        this.emitter.setMaxListeners(100);
    }

    emit<K extends EventKey>(event: K, data: EventMap[K]): void {
        const listeners = this.emitter.listeners(event);
        for (const listener of listeners) {
            try {
                listener(data);
            } catch (err) {
                console.error(`[agent:eventbus] listener for "${event}" threw:`, err);
            }
        }
    }

    on<K extends EventKey>(event: K, handler: EventHandler<EventMap[K]>): () => void {
        this.emitter.on(event, handler as EventHandler<unknown>);
        return () => {
            this.emitter.off(event, handler as EventHandler<unknown>);
        };
    }

    once<K extends EventKey>(event: K, handler: EventHandler<EventMap[K]>): void {
        this.emitter.once(event, handler as EventHandler<unknown>);
    }

    off<K extends EventKey>(event: K, handler: EventHandler<EventMap[K]>): void {
        this.emitter.off(event, handler as EventHandler<unknown>);
    }

    emitRaw(event: string, data: unknown): void {
        this.emit(event as EventKey, data as EventMap[EventKey]);
    }

    onRaw(event: string, handler: EventHandler<unknown>): () => void {
        return this.on(event as EventKey, handler as EventHandler<EventMap[EventKey]>);
    }

    wrapNarEventBus(narBus: NarEventBus): void {
        const ts = () => Date.now();
        const unsub1 = narBus.on('rule:applied', (d) => {
            const term = d.conclusion?.toString?.() ?? '';
            this.emitter.emit('nar:derivation', {term, confidence: d.truth?.c ?? 0, timestamp: ts()});
        });
        const unsub2 = narBus.on('concept:created', (d) => {
            this.emitter.emit('nar:concept:activated', {
                term: d.term?.toString?.() ?? '',
                priority: d.priority,
                timestamp: ts(),
            });
        });
        const unsub3 = narBus.on('lm-rule:executed', (d) => {
            this.emitter.emit('system:lm.rule:applied', {
                ruleId: d.ruleId,
                ruleName: d.ruleId,
                primaryTerm: '',
                tasksProduced: d.tasksGenerated,
                durationMs: d.durationMs,
                timestamp: ts(),
            });
        });
        const unsub4 = narBus.on('lm-rule:failed', (d) => {
            this.emitter.emit('system:lm.rule:skipped', {
                ruleId: d.ruleId,
                ruleName: d.ruleId,
                reason: 'activation_failed',
                timestamp: ts(),
            });
        });
        this.narUnsubscribers.push(unsub1, unsub2, unsub3, unsub4);
    }

    removeAllListeners(event?: EventKey): void {
        if (event) {
            this.emitter.removeAllListeners(event);
        } else {
            this.emitter.removeAllListeners();
            for (const unsub of this.narUnsubscribers) unsub();
            this.narUnsubscribers.length = 0;
        }
    }

    listenerCount(event: EventKey): number {
        return this.emitter.listenerCount(event);
    }
}
