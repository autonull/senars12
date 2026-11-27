import { defaultLogger } from '../util/logger';
import { errMsg } from '../util/error';
/**
 * One subject's listener set — the shared core of {@link EventBus} and
 * {@link Signal}. A throwing listener is isolated and logged rather than
 * allowed to stop the producer.
 */
export class ListenerBag {
    #listeners = new Set();
    #logger;
    constructor(logger = defaultLogger) {
        this.#logger = logger;
    }
    get size() {
        return this.#listeners.size;
    }
    on(fn) {
        return this.#add(fn, false);
    }
    once(fn) {
        return this.#add(fn, true);
    }
    #add(fn, once) {
        const listener = { fn, once };
        this.#listeners.add(listener);
        return () => this.off(fn);
    }
    off(fn) {
        for (const listener of this.#listeners) {
            if (listener.fn === fn)
                this.#listeners.delete(listener);
        }
    }
    emit(value) {
        for (const listener of [...this.#listeners]) {
            try {
                listener.fn(value);
            }
            catch (e) {
                this.#logger.warn('Event listener threw; remaining listeners still ran', {
                    error: errMsg(e),
                });
            }
            finally {
                if (listener.once)
                    this.#listeners.delete(listener);
            }
        }
    }
    receivers() {
        return [...this.#listeners].map((l) => l.fn);
    }
    clear() {
        this.#listeners.clear();
    }
}
