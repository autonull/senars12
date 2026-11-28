import { type Logger } from '../util/logger';
import type { EventReceiver, EventUnsubscribe } from './types';
/**
 * One subject's listener set — the shared core of {@link EventBus} and
 * {@link Signal}. A throwing listener is isolated and logged rather than
 * allowed to stop the producer.
 */
export declare class ListenerBag<T> {
    #private;
    constructor(logger?: Logger);
    get size(): number;
    on(fn: EventReceiver<T>): EventUnsubscribe;
    once(fn: EventReceiver<T>): EventUnsubscribe;
    off(fn: EventReceiver<T>): void;
    emit(value: T): void;
    receivers(): EventReceiver<T>[];
    clear(): void;
}
//# sourceMappingURL=listener-bag.d.ts.map