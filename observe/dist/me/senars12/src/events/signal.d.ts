import { type Logger } from '../util/logger';
import type { EventReceiver, EventUnsubscribe } from './types';
/**
 * One subject, any number of listeners — the unnamed case {@link EventBus} generalises.
 *
 * The two are kept separate because `EventBus` pays for a name-keyed `Map` that
 * a single subject never reads.
 */
export declare class Signal<T> {
    #private;
    constructor(logger?: Logger);
    get size(): number;
    on(receiver: EventReceiver<T>): EventUnsubscribe;
    off(receiver: EventReceiver<T>): void;
    emit(value: T): void;
    receivers(): EventReceiver<T>[];
    clear(): void;
}
//# sourceMappingURL=signal.d.ts.map