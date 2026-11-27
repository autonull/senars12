/**
 * Phase E (REFACTOR.todo2 §14 tail): finer-grained reputation keys.
 * `provider:<name>` for LM channels, `domain:<host>` for URL-bearing sources;
 * plain ids (e.g. `user`, `peer:<id>`) pass through unchanged. Derivation is
 * best-effort: when no finer key is derivable the caller's legacy key stands
 * (fallback parity, risk R6).
 */
/** Derive a `domain:<host>` key from a URL-bearing source id, else undefined. */
export const domainKey = (sourceId) => {
    const match = /https?:\/\/[^\s/]+/i.exec(sourceId);
    if (!match)
        return undefined;
    try {
        return `domain:${new URL(match[0]).host}`;
    }
    catch {
        return undefined;
    }
};
/** Derive a `provider:<name>` key for an LM provider, else undefined. */
export const providerKey = (provider) => provider?.trim() ? `provider:${provider.trim()}` : undefined;
