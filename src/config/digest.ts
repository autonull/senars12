/**
 * Config digest — a stable fingerprint of a configuration.
 *
 * Two runs of the same configuration must agree on the digest, and any
 * semantic change must change it. Keys are sorted so JSON object order is
 * not a difference; functions are omitted because a closure is not data.
 */

import { createHash } from 'node:crypto';

const stable = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stable);
  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((out, key) => {
      const next = record[key];
      if (typeof next !== 'function') out[key] = stable(next);
      return out;
    }, {});
}

/** A deterministic SHA-256 digest of `config`, optionally prefixed with `name`. */
export const configDigest = (name: string, config: unknown): string =>
  createHash('sha256').update(JSON.stringify(stable({ name, config }))).digest('hex');

/** A short form of {@link configDigest}, for logs. */
export const shortConfigDigest = (config: unknown): string => configDigest('', config).slice(0, 16);
