import { type Logger } from '../util/logger';
import type { EventReceiver, EventUnsubscribe } from './types';
/**
 * A named-event fan-out: one listener bag per event name, dropped when empty.
 *
 * `T` is constrained to `object` rather than to `Record<string, unknown>` because
 * an event-map *interface* has no index signature, and the index signature a
 * consumer had to add to satisfy the older constraint widened `keyof T` to
 * `string` — which is what let a bus accept an event name its map never declared.
 */
export declare class EventBus<T extends object = Record<string, unknown>> {
    #private;
    private bags;
    private readonly logger;
    constructor(logger?: Logger);
    on<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe;
    once<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): EventUnsubscribe;
    off<K extends keyof T>(eventName: K & string, fn: EventReceiver<T[K]>): void;
    /**
     * A signal declared with a `void` payload is emitted with no argument, so the
     * call site reads `emit('tick')` rather than `emit('tick', undefined)`. The
     * conditional tuple is what makes that optional for void signals while staying
     * required — and therefore checked — for every other one.
     */
    emit<K extends keyof T>(eventName: K & string, ...args: void extends T[K] ? [params?: T[K]] : [params: T[K]]): void;
    clear(): void;
    listenerCount(eventName: string): number;
}
//# sourceMappingURL=event-bus.d.ts.map