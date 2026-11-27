import { defaultLogger } from '../util/logger';
import { ListenerBag } from './listener-bag';
/**
 * One subject, any number of listeners — the unnamed case {@link EventBus} generalises.
 *
 * The two are kept separate because `EventBus` pays for a name-keyed `Map` that
 * a single subject never reads.
 */
export class Signal {
    #bag;
    constructor(logger = defaultLogger) {
        this.#bag = new ListenerBag(logger);
    }
    get size() {
        return this.#bag.size;
    }
    on(receiver) {
        return this.#bag.on(receiver);
    }
    off(receiver) {
        this.#bag.off(receiver);
    }
    emit(value) {
        this.#bag.emit(value);
    }
    receivers() {
        return this.#bag.receivers();
    }
    clear() {
        this.#bag.clear();
    }
}
