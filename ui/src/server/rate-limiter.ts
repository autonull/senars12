export class RateLimiter {
    private buckets: Map<string, { tokens: number; lastRefill: number }>;

    constructor(private limits: Record<string, number>) {
        this.buckets = new Map();
        for (const key of Object.keys(limits)) {
            this.buckets.set(key, {tokens: limits[key]!, lastRefill: Date.now()});
        }
    }

    consume(key: string): boolean {
        const bucket = this.buckets.get(key);
        if (!bucket) return false;
        const now = Date.now();
        const elapsed = (now - bucket.lastRefill) / 1000;
        bucket.tokens = Math.min(this.limits[key]!, bucket.tokens + elapsed * this.limits[key]!);
        bucket.lastRefill = now;
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return true;
        }
        return false;
    }
}
