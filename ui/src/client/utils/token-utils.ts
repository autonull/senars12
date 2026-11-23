/** Shared token utilities for build and test parity. */

export interface TokenTree {
  [key: string]: unknown;
}

export type FlatTokens = Record<string, string>;

/** Flatten a nested token tree into a flat record with dot-notation paths. */
export function flattenTokens(obj: TokenTree, prefix = ''): FlatTokens {
  return Object.fromEntries(
    Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(flattenTokens(value as TokenTree, path));
      }
      return [[path, String(value)]];
    })
  );
}

/** Resolve {ref} references in a token value using a flat token map. */
function resolveRefs(value: string, flat: FlatTokens, visited = new Set<string>()): string {
  return value.replace(/\{([^}]+)\}/g, (_, path) => {
    if (visited.has(path)) throw new Error(`Circular reference: ${path}`);
    visited.add(path);
    const resolved = flat[path];
    if (resolved === undefined) throw new Error(`Missing token: ${path}`);
    return resolved.match(/\{/) ? resolveRefs(resolved, flat, visited) : resolved;
  });
}

/** Resolve all tokens in a flat map, returning a new flat map with resolved values. */
export function resolveTheme(base: FlatTokens, overrides: FlatTokens): FlatTokens {
  const flat = { ...base, ...overrides };
  return Object.fromEntries(
    Object.entries(flat).map(([path, value]) => [path, resolveRefs(value, flat)])
  );
}

export { resolveRefs };