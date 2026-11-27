/**
 * Single-writer push buffer exposed as an async iterator — the one bridge
 * between `notify`-style callbacks (config views, event logs) and `for await`
 * consumers. Multiple waiters are served FIFO; `close` releases all of them.
 */
export class PushQueue {
    #items = [];
    #waiters = [];
    #closed = false;
    onClose;
    get closed() {
        return this.#closed;
    }
    get size() {
        return this.#items.length;
    }
    push(item) {
        if (this.#closed)
            return;
        const waiter = this.#waiters.shift();
        if (waiter)
            waiter({ value: item, done: false });
        else
            this.#items.push(item);
    }
    close() {
        if (this.#closed)
            return;
        this.#closed = true;
        for (const waiter of this.#waiters.splice(0))
            waiter({ value: undefined, done: true });
        this.onClose?.();
    }
    next() {
        const item = this.#items.shift();
        if (item !== undefined)
            return Promise.resolve({ value: item, done: false });
        if (this.#closed)
            return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.#waiters.push(resolve));
    }
    [Symbol.asyncIterator]() {
        return {
            next: () => this.next(),
            return: async () => {
                this.close();
                return { value: undefined, done: true };
            },
        };
    }
}
