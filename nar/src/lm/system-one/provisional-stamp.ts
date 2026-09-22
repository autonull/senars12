import type { Stamp } from '../../terms/stamp.js';

export interface ProvisionalStamp {
  kind: 'provisional';
  stamp: Stamp;
  cInitial: number;
  decayRate: number;
  createdAt: number;
  expiresAt: number;

  confidence(now: number): number;
}

export function createProvisionalStamp(
  stamp: Stamp,
  cInitial: number,
  decayRate: number,
  maxTtlMs: number
): ProvisionalStamp {
  const createdAt = Date.now();
  return {
    kind: 'provisional',
    stamp,
    cInitial,
    decayRate,
    createdAt,
    expiresAt: createdAt + maxTtlMs,
    confidence(now: number): number {
      if (now > this.expiresAt) return 0;
      const elapsed = (now - this.createdAt) / 1000;
      return this.cInitial * Math.exp(-this.decayRate * elapsed);
    },
  };
}

export function isProvisionalStamp(value: unknown): value is ProvisionalStamp {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value as { kind: string }).kind === 'provisional'
  );
}
