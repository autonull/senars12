export class SingleFlight {
    private readonly inflight = new Map<string, Promise<unknown>>();

    run<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const existing = this.inflight.get(key);
        if (existing) return existing as Promise<T>;
        const p = fn().finally(() => {
            if (this.inflight.get(key) === p) this.inflight.delete(key);
        });
        this.inflight.set(key, p);
        return p;
    }

    get size(): number {
        return this.inflight.size;
    }
}
