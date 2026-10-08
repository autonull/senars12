/**
 * Citations (§3.3 "citations model"). Reference-style links (`[1]: https://…`)
 * become a stable-keyed bibliography so a formal citation can be told apart
 * from a plain hyperlink and referenced as `[n]`. Pure over the WorkspaceGraph;
 * numbering follows document (insertion) order.
 */

import { asCitationData } from './segmentation.js';
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
    const data = asCitationData(block.data);
    if (!data?.key || seen.has(data.key)) continue;
    seen.add(data.key);
    sources.push({ key: data.key, href: data.href, index: sources.length + 1, label: data.label });
  }
  return sources;
}

/** Resolve a `[key]` reference against a bibliography, or `undefined` when unknown. */
export function resolveSource(key: string, sources: readonly Source[]): Source | undefined {
  const normalized = key.trim().replace(/^\[|\]$/g, '');
  return sources.find((source) => source.key === normalized);
}
