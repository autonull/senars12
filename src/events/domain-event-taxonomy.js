/**
 * Canonical domain event taxonomy.
 *
 * Single source of truth for event names, scopes, and payload shapes.
 * Used by `emitDomainEvent` callers and consumers (OTel exporter, loggers, etc.).
 *
 * Naming convention: `{subsystem}.{action}` — e.g., `thread.backpressure`, `strategy.reconfigure`.
 * Scope identifies the subsystem for routing/filtering.
 */
/** Canonical event names. */
export const DOMAIN_EVENTS = {
    /** Thread backpressure event. */
    THREAD_BACKPRESSURE: 'thread.backpressure',
    /** Bag pressure transition event. */
    BAG_PRESSURE_TRANSITION: 'bag.pressure.transition',
    /** Strategy reconfigure event. */
    STRATEGY_RECONFIGURE: 'strategy.reconfigure',
    /** Strategy selection event. */
    STRATEGY_SELECTION: 'strategy.selection',
    /** Budget slice event. */
    BUDGET_SLICE: 'budget.slice',
};
/** Event scope mapping (for routing/filtering). */
export const EVENT_SCOPES = {
    [DOMAIN_EVENTS.THREAD_BACKPRESSURE]: 'thread',
    [DOMAIN_EVENTS.BAG_PRESSURE_TRANSITION]: 'bag',
    [DOMAIN_EVENTS.STRATEGY_RECONFIGURE]: 'strategy',
    [DOMAIN_EVENTS.STRATEGY_SELECTION]: 'strategy',
    [DOMAIN_EVENTS.BUDGET_SLICE]: 'budget',
};
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
export function emitTypedEvent(eventName, payload) {
    // This is a compile-time check; at runtime it calls the untyped sink.
    // The actual emission is done by the caller via emitDomainEvent.
    const scope = EVENT_SCOPES[eventName] ?? '';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _check = payload;
}
/**
 * Get the canonical scope for an event name.
 */
export function getEventScope(eventName) {
    return EVENT_SCOPES[eventName] ?? '';
}
/**
 * Get all registered event names.
 */
export function getAllEventNames() {
    return Object.values(DOMAIN_EVENTS);
}
/**
 * Check if an event name is registered.
 */
export function isKnownEvent(eventName) {
    return Object.values(DOMAIN_EVENTS).includes(eventName);
}
