/**
 * Config digest — a stable fingerprint of a configuration.
 *
 * Two runs of the same configuration must agree on the digest, and any
 * semantic change must change it. Keys are sorted so JSON object order is
 * not a difference; functions are omitted because a closure is not data.
 */
import { createHash } from 'node:crypto';
const stable = (value) => {
    if (value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value)) {
        // Sort arrays by a stable key if they contain objects with a 'name' property
        const mapped = value.map(stable);
        if (mapped.length > 0 && typeof mapped[0] === 'object' && mapped[0] !== null && 'name' in mapped[0]) {
            return [...mapped].sort((a, b) => a.name.localeCompare(b.name));
        }
        return mapped;
    }
    const record = value;
    return Object.keys(record)
        .sort()
        .reduce((out, key) => {
        const next = record[key];
        if (typeof next !== 'function')
            out[key] = stable(next);
        return out;
    }, {});
};
/** A deterministic SHA-256 digest of `config`, optionally prefixed with `name`. */
export const configDigest = (name, config) => createHash('sha256').update(JSON.stringify(stable({ name, config }))).digest('hex');
/** A short form of {@link configDigest}, for logs. */
export const shortConfigDigest = (config) => configDigest('', config).slice(0, 16);
