/**
 * TODO25 Phase C (N3): curriculum / probe selection over flywheel-produced
 * graded data. Probes are the highest-signal items the dialogue flywheel has
 * already graded — corrected turns first (strongest negative signal), then
 * low trace-quality turns. Digests only (I6); deterministic ordering (stable
 * sort, digest tie-break); frozen-eval rows are never in this data (I1).
 */
import type { Episode } from '@senars/util';

export type ProbeKind = 'correction' | 'low-grade';

export interface Probe {
  /** Turn/correlationId the probe was derived from (a digest-pinned key, not raw text). */
  id: string;
  kind: ProbeKind;
  /** Selection score — higher = more informative probe. */
  score: number;
}

export interface CurriculumSource {
  /** Reaction episodes (`type: 'reaction'`). */
  reactions(): Promise<readonly Episode[]>;
  /** Trace grades by correlationId (existing TraceGradeInput plumbing). */
  grades(): ReadonlyMap<string, number>;
}

export interface ProbeSelection {
  /** Corrections dominate: prefer turns that were explicitly corrected. */
  limit?: number;
  /** Trace grades below this are probed (default 0.5). */
  lowGradeThreshold?: number;
}

const CORRECTION_SCORE = 1;

export const selectProbes = async (
  source: CurriculumSource,
  options: ProbeSelection = {}
): Promise<Probe[]> => {
  const limit = options.limit ?? 16;
  const threshold = options.lowGradeThreshold ?? 0.5;
  const probes: Probe[] = [];

  for (const e of await source.reactions()) {
    const meta = e.metadata as { turnId?: string; kind?: string };
    if (meta.kind === 'correct' && meta.turnId) {
      probes.push({ id: meta.turnId, kind: 'correction', score: CORRECTION_SCORE });
    }
  }
  for (const [correlationId, score] of source.grades()) {
    if (score < threshold) probes.push({ id: correlationId, kind: 'low-grade', score });
  }

  // Deterministic: score desc, digest tie-break, deduped by id (corrections win).
  const byId = new Map<string, Probe>();
  for (const p of probes) if (!byId.has(p.id)) byId.set(p.id, p);
  return [...byId.values()]
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, limit);
};
