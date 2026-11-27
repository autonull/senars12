/**
 * Single-writer push buffer exposed as an async iterator — the one bridge
 * between `notify`-style callbacks (config views, event logs) and `for await`
 * consumers. Multiple waiters are served FIFO; `close` releases all of them.
 */
export declare class PushQueue<T> {
    #private;
    onClose?: () => void;
    get closed(): boolean;
    get size(): number;
    push(item: T): void;
    close(): void;
    next(): Promise<IteratorResult<T>>;
    [Symbol.asyncIterator](): AsyncIterator<T>;
}
//# sourceMappingURL=push-queue.d.ts.map