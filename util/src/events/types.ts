/**
 * Shared event types — extracted to break EventBus <-> ListenerBag cycle.
 */

export type EventReceiver<T> = (params: T) => void;
export type EventUnsubscribe = () => void;