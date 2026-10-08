/**
 * Citations (§3.3 "citations model"). Reference-style links (`[1]: https://…`)
 * become a stable-keyed bibliography so a formal citation can be told apart
 * from a plain hyperlink and referenced as `[n]`. Pure over the WorkspaceGraph;
 * numbering follows document (insertion) order.
 */

import { payloadOf } from './block-payload.js';
import type { WorkspaceGraph } from './workspace-graph.js';

export interface Source {
  /** Stable citation key as written, e.g. `1` or `iso-42001`. */
  key: string;
  href: string;
  /** 1-based position in the bibliography, for `[n]` references. */
  index: number;
  /** Optional display label (reference definitions usually have none). */
  label?: string;
}

/** The bibliography: reference-style citation blocks, de-duplicated by key. */
export function collectSources(graph: WorkspaceGraph): Source[] {
  const sources: Source[] = [];
  const seen = new Set<string>();
  for (const block of graph.blocks.values()) {
    if (block.kind !== 'citation') continue;
    const data = payloadOf(block.data, 'citation');
    if (!data?.key || seen.has(data.key)) continue;
    seen.add(data.key);
    sources.push({ key: data.key, href: data.href, index: sources.length + 1, label: data.label });
  }
  return sources;
}

/**
 * Resolve a `[key]` reference against a bibliography, or `undefined` when
 * unknown. A key matches the citation key first, then — for a numeric reference —
 * the bibliography position, so `[2]` resolves `[n]`-style numbering even when
 * the stable key is not a number.
 */
export function resolveSource(key: string, sources: readonly Source[]): Source | undefined {
  const normalized = key.trim().replace(/^\[|\]$/g, '');
  const position = Number(normalized);
  return (
    sources.find((source) => source.key === normalized) ??
    (Number.isInteger(position) && position > 0 ? sources[position - 1] : undefined)
  );
}
