import { defaultLogger } from '../util/logger';
import { getOrInsert } from '../util/collections';
import { ListenerBag } from './listener-bag';
/**
 * A named-event fan-out: one listener bag per event name, dropped when empty.
 *
 * `T` is constrained to `object` rather than to `Record<string, unknown>` because
 * an event-map *interface* has no index signature, and the index signature a
 * consumer had to add to satisfy the older constraint widened `keyof T` to
 * `string` — which is what let a bus accept an event name its map never declared.
 */
export class EventBus {
    bags = new Map();
    logger;
    constructor(logger = defaultLogger) {
        this.logger = logger;
    }
    on(eventName, fn) {
        return this.#bag(eventName).on(fn);
    }
    once(eventName, fn) {
        return this.#bag(eventName).once(fn);
    }
    #bag(name) {
        return getOrInsert(this.bags, name, () => new ListenerBag(this.logger));
    }
    off(eventName, fn) {
        const bag = this.bags.get(eventName);
        if (!bag)
            return;
        bag.off(fn);
        if (bag.size === 0)
            this.bags.delete(eventName);
    }
    /**
     * A signal declared with a `void` payload is emitted with no argument, so the
     * call site reads `emit('tick')` rather than `emit('tick', undefined)`. The
     * conditional tuple is what makes that optional for void signals while staying
     * required — and therefore checked — for every other one.
     */
    emit(eventName, ...args) {
        const bag = this.bags.get(eventName);
        if (!bag)
            return;
        bag.emit(args[0]);
        if (bag.size === 0)
            this.bags.delete(eventName);
    }
    clear() {
        this.bags.clear();
    }
    listenerCount(eventName) {
        return this.bags.get(eventName)?.size ?? 0;
    }
}
