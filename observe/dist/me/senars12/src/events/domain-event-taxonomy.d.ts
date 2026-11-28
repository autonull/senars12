/**
 * Canonical domain event taxonomy.
 *
 * Single source of truth for event names, scopes, and payload shapes.
 * Used by `emitDomainEvent` callers and consumers (OTel exporter, loggers, etc.).
 *
 * Naming convention: `{subsystem}.{action}` — e.g., `thread.backpressure`, `strategy.reconfigure`.
 * Scope identifies the subsystem for routing/filtering.
 */
import type { DomainEventPayload } from '../agent/event-sink';
/** Event emitted when a thread hits backpressure. */
export interface ThreadBackpressurePayload extends DomainEventPayload {
    /** The thread ID that hit backpressure. */
    threadId: string;
    /** Current pressure level (0-1). */
    pressure: number;
    /** Maximum capacity. */
    capacity: number;
    /** Current size. */
    size: number;
    /** Whether the thread is paused. */
    paused: boolean;
}
/** Event emitted when bag pressure transitions. */
export interface BagPressureTransitionPayload extends DomainEventPayload {
    /** Unique bag identifier. */
    bagId: string;
    /** Current pressure level (0-1). */
    pressure: number;
    /** Maximum capacity. */
    capacity: number;
    /** Current size. */
    size: number;
    /** Transition type: 'enter' | 'exit' | 'threshold'. */
    transition: 'enter' | 'exit' | 'threshold';
}
/** Event emitted when a strategy is reconfigured. */
export interface StrategyReconfigurePayload extends DomainEventPayload {
    /** Strategy type: 'sampling' | 'premise' | 'derivation' | 'lm-rule' | 'attention' | 'bag'. */
    type: string;
    /** New strategy spec (name or expression). */
    spec: string;
    /** Optional config. */
    config?: Record<string, unknown>;
}
/** Event emitted when a strategy is selected for a task. */
export interface StrategySelectionPayload extends DomainEventPayload {
    /** Strategy type. */
    type: string;
    /** Selected strategy name(s). */
    spec: string;
    /** Task ID or correlation ID. */
    taskId?: string;
}
/** Event emitted for budget slice operations. */
export interface BudgetSlicePayload extends DomainEventPayload {
    /** Budget event type. */
    event: 'consumed' | 'refunded' | 'exhausted' | 'warning';
    /** Budget category. */
    category: string;
    /** Amount consumed/refunded. */
    amount: number;
    /** Remaining budget. */
    remaining: number;
    /** Total budget. */
    total: number;
}
/** Union of all known domain event payloads. */
export type AnyDomainEventPayload = ThreadBackpressurePayload | BagPressureTransitionPayload | StrategyReconfigurePayload | StrategySelectionPayload | BudgetSlicePayload;
/** Canonical event names. */
export declare const DOMAIN_EVENTS: {
    /** Thread backpressure event. */
    readonly THREAD_BACKPRESSURE: 'thread.backpressure';
    /** Bag pressure transition event. */
    readonly BAG_PRESSURE_TRANSITION: 'bag.pressure.transition';
    /** Strategy reconfigure event. */
    readonly STRATEGY_RECONFIGURE: 'strategy.reconfigure';
    /** Strategy selection event. */
    readonly STRATEGY_SELECTION: 'strategy.selection';
    /** Budget slice event. */
    readonly BUDGET_SLICE: 'budget.slice';
};
/** Event scope mapping (for routing/filtering). */
export declare const EVENT_SCOPES: Record<string, string>;
/**
 * Type-safe event emitter helper.
 *
 * Usage:
 * ```ts
 * emitTypedEvent(DOMAIN_EVENTS.THREAD_BACKPRESSURE, {
 *   threadId: 't1',
 *   pressure: 0.9,
 *   capacity: 1000,
 *   size: 950,
 *   paused: true,
 * });
 * ```
 */
export declare function emitTypedEvent<K extends keyof typeof DOMAIN_EVENTS>(eventName: K, payload: Extract<AnyDomainEventPayload, {
    type?: never;
}> & Record<string, unknown>): void;
/**
 * Get the canonical scope for an event name.
 */
export declare function getEventScope(eventName: string): string;
/**
 * Get all registered event names.
 */
export declare function getAllEventNames(): readonly string[];
/**
 * Check if an event name is registered.
 */
export declare function isKnownEvent(eventName: string): boolean;
//# sourceMappingURL=domain-event-taxonomy.d.ts.map