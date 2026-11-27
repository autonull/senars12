import { decayCurve } from '@senars/util/numeric';
export function createProvisionalStamp(stamp, cInitial, decayRate, maxTtlMs) {
    const createdAt = Date.now();
    return {
        kind: 'provisional',
        stamp,
        cInitial,
        decayRate,
        createdAt,
        expiresAt: createdAt + maxTtlMs,
        confidence(now) {
            if (now > this.expiresAt)
                return 0;
            const elapsed = (now - this.createdAt) / 1000;
            return decayCurve(this.cInitial, this.decayRate, elapsed);
        },
    };
}
export function isProvisionalStamp(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'kind' in value &&
        value.kind === 'provisional');
}
