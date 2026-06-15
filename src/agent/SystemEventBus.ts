import {EventEmitter} from 'node:events';
import type {EventBus} from '../nar/types';

export interface SystemEventMap {
    'nar:derivation': {term: string; confidence: number; timestamp: number};
    'nar:concept:activated': {term: string; priority: number; timestamp: number};
    'nar:goal:resolved': {term: string; timestamp: number};
    'nar:conflict:detected': {term: string; conflictWith: string; timestamp: number};
    'nar:task:added': {term: string; type: string; timestamp: number};
    'nar:drive:changed': {drive: string; urgency: number; timestamp: number};
    'nar:reasoning:cycle': {cycle: number; derived: number; strategyPriority: string | null; effectiveSteps: number; timestamp: number};
    'lm.rule:applied': {ruleId: string; ruleName: string; primaryTerm: string; secondaryTerm?: string; tasksProduced: number; durationMs: number; timestamp: number; schema?: string};
    'lm.rule:skipped': {ruleId: string; ruleName: string; reason: 'circuit_open' | 'disabled' | 'activation_failed' | 'single_premise_missing'; timestamp: number};
    'lm.rule:structured': {ruleId: string; schema: string; output: unknown; timestamp: number};
    'lm.rule:constitution-violation': {ruleId: string; term: string; clause: string; timestamp: number};
    'agent:input': {input: string; timestamp: number};
    'agent:reply': {reply: string; durationMs: number; timestamp: number};
    'agent:error': {error: string; context?: unknown; timestamp: number};
}

type EventKey = keyof SystemEventMap;
type EventHandler<T> = (data: T) => void;

export class SystemEventBus {
    private readonly emitter = new EventEmitter();
    private readonly narUnsubscribers: Array<() => void> = [];

    constructor() {
        this.emitter.setMaxListeners(50);
    }

    emit<K extends EventKey>(event: K, data: SystemEventMap[K]): void {
        this.emitter.emit(event, data);
    }

    on<K extends EventKey>(event: K, handler: EventHandler<SystemEventMap[K]>): () => void {
        this.emitter.on(event, handler as EventHandler<unknown>);
        return () => {
            this.emitter.off(event, handler as EventHandler<unknown>);
        };
    }

    once<K extends EventKey>(event: K, handler: EventHandler<SystemEventMap[K]>): void {
        this.emitter.once(event, handler as EventHandler<unknown>);
    }

    off<K extends EventKey>(event: K, handler: EventHandler<SystemEventMap[K]>): void {
        this.emitter.off(event, handler as EventHandler<unknown>);
    }

    wrapNarEventBus(narBus: EventBus): void {
        const ts = () => Date.now();
        const unsub1 = narBus.on('rule:applied', (d) => {
            const term = d.conclusion?.toString?.() ?? '';
            this.emitter.emit('nar:derivation', {term, confidence: d.truth?.c ?? 0, timestamp: ts()});
        });
        const unsub2 = narBus.on('concept:created', (d) => {
            this.emitter.emit('nar:concept:activated', {term: d.term?.toString?.() ?? '', priority: d.priority, timestamp: ts()});
        });
        const unsub3 = narBus.on('lm-rule:executed', (d) => {
            this.emitter.emit('lm.rule:applied', {ruleId: d.ruleId, ruleName: d.ruleId, primaryTerm: '', tasksProduced: d.tasksGenerated, durationMs: d.durationMs, timestamp: ts()});
        });
        const unsub4 = narBus.on('lm-rule:failed', (d) => {
            this.emitter.emit('lm.rule:skipped', {ruleId: d.ruleId, ruleName: d.ruleId, reason: 'activation_failed', timestamp: ts()});
        });
        this.narUnsubscribers.push(unsub1, unsub2, unsub3, unsub4);
    }

    removeAllListeners(): void {
        this.emitter.removeAllListeners();
        for (const unsub of this.narUnsubscribers) unsub();
        this.narUnsubscribers.length = 0;
    }
}
