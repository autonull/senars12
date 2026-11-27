/**
 * Keyed sliding-window rate limiting — the one admission clock behind the
 * transport middleware and the hand-rolled HTTP guards.
 *
 * A window is the newest `limit` arrival stamps in a `BoundedRing`, so the hot
 * path is O(1) with no allocation and no timer: an arrival is admitted when the
 * oldest retained stamp has aged out of `windowMs`. Key spaces are bounded by an
 * LRU of windows, so a caller that keys on request-supplied values cannot grow
 * the limiter without limit.
 */
import { type Clock } from './clock';
export interface RateLimiterOptions {
    /** Arrivals admitted per `windowMs`. */
    limit: number;
    /** Window width in ms. */
    windowMs: number;
    /** Distinct keys retained; the least recently used window is dropped past it. Default: 1024. */
    maxKeys?: number;
    /** Injected clock (deterministic tests). */
    now?: Clock;
}
export declare class SlidingWindowRateLimiter {
    #private;
    constructor(options: RateLimiterOptions);
    /** Record an arrival under `key` and report whether it fits the allowance. */
    tryAcquire(key?: string, now?: number): boolean;
    /** Forget one key's history, or all of it. */
    reset(key?: string): void;
}
//# sourceMappingURL=rate-limit.d.ts.map