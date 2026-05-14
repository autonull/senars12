import type {Term, Truth} from '../terms';

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
                // Continue to next listener even if one throws
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


