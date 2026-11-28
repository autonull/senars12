/**
 * Config digest — a stable fingerprint of a configuration.
 *
 * Two runs of the same configuration must agree on the digest, and any
 * semantic change must change it. Keys are sorted so JSON object order is
 * not a difference; functions are omitted because a closure is not data.
 */
/** A deterministic SHA-256 digest of `config`, optionally prefixed with `name`. */
export declare const configDigest: (name: string, config: unknown) => string;
/** A short form of {@link configDigest}, for logs. */
export declare const shortConfigDigest: (config: unknown) => string;
//# sourceMappingURL=digest.d.ts.map