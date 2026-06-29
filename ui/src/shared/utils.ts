/**
 * Creates a unique edge key from source and target node IDs.
 */
export const edgeKey = (source: string, target: string): string => `${source}->${target}`;

let msgCounter = 0;

/**
 * Generates a unique ID with the given prefix.
 * Format: {prefix}-{timestamp}-{counter}-{random}
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Extracts the first word from content as a term identifier.
 * Strips non-alphanumeric characters and limits to 40 chars.
 */
export function extractTerm(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;
  const words = trimmed.split(/\s+/);
  return words[0]?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) ?? undefined;
}
