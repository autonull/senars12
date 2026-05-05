export interface ThrottleConfig {
    intervalMs: number;
    burst: number;
}

export class Throttle {
    private tokens: number;
    private lastRefill = Date.now();
    private config: ThrottleConfig;

    constructor(config: Partial<ThrottleConfig> = {}) {
        this.config = {
            intervalMs: config.intervalMs ?? 10,
            burst: config.burst ?? 1
        };
        this.tokens = this.config.burst;
    }

    async acquire(): Promise<void> {
        this.refill();
        if (this.tokens > 0) {
            this.tokens--;
            return;
        }
        await new Promise(r => setTimeout(r, this.config.intervalMs));
        this.tokens--;
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const refills = Math.floor(elapsed / this.config.intervalMs);
        if (refills > 0) {
            this.tokens = Math.min(this.config.burst, this.tokens + refills);
            this.lastRefill = now;
        }
    }

    getAvailable(): number {
        this.refill();
        return this.tokens;
    }

    reset(): void {
        this.tokens = this.config.burst;
        this.lastRefill = Date.now();
    }
}

export function createThrottle(config?: Partial<ThrottleConfig>): Throttle {
    return new Throttle(config);
}