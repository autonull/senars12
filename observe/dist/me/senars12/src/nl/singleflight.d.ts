export declare class SingleFlight {
    private readonly inflight;
    constructor(options?: {
        maxInflight?: number;
    });
    run<T>(key: string, fn: () => Promise<T>): Promise<T>;
    get size(): number;
}
//# sourceMappingURL=singleflight.d.ts.map