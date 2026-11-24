/**
 * Events — unified event taxonomy and emission.
 */

// New unified event system
export * from './taxonomy';
export * from './emitter';

// Legacy EventBus for backward compatibility
export { EventBus } from './event-bus';
export { ListenerBag } from './listener-bag';
export type { EventReceiver, EventUnsubscribe } from './types';
export { Signal } from './signal';
export { PushQueue } from './push-queue';
export { narEventToCognitive, MAPPED_NAR_EVENTS } from './bridge';
export * from './domain-event-taxonomy';