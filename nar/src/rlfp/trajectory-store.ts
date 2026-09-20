import { promises as fs } from 'node:fs';
import type { TrajectoryStep } from './ReasoningTrajectoryLogger.js';

/** Grades from one completed agent cycle (E4 trace grading). */
export interface CycleGrades {
  groundedness?: { score: number; abstained: boolean };
  risks: { command: string; score: number; abstained: boolean }[];
  /** Egress-gate verdict — groundedness ground truth when present. */
  egress?: { grounded: boolean; score?: number };
}

/** One persisted per-cycle trajectory: the graded steps of a single agent cycle. */
export interface CycleTrajectory {
  correlationId: string;
  timestamp: number;
  steps: TrajectoryStep[];
  grades?: CycleGrades;
}

export interface TrajectoryPair {
  trajectoryA: CycleTrajectory;
  trajectoryB: CycleTrajectory;
  preference: 'A' | 'B' | 'SKIP';
}

/**
 * E4 follow-up (a): persists per-cycle grades as trajectory steps and pairs the
 * two most recent cycles for implicit RLFP preferences — the grade-based pairing
 * `PreferenceCollector.collectPreference` needs (without the interactive prompt).
 * Grade order: higher groundedness wins; ties broken by lower mean risk; equal
 * on both ⇒ 'SKIP' (no preference from indistinguishable cycles).
 */
export class TrajectoryStore {
  readonly #cycles: CycleTrajectory[] = [];
  readonly #path?: string;

  constructor(path?: string) {
    this.#path = path;
  }

  async recordCycle(cycle: CycleTrajectory): Promise<void> {
    this.#cycles.push(cycle);
    if (!this.#path) return;
    await fs.appendFile(this.#path, `${JSON.stringify(cycle)}\n`, 'utf-8');
  }

  async load(): Promise<void> {
    if (!this.#path) return;
    try {
      const content = await fs.readFile(this.#path, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          this.#cycles.push(JSON.parse(line) as CycleTrajectory);
        } catch {
          /* skip malformed lines — append-only tolerance */
        }
      }
    } catch {
      /* no store yet */
    }
  }

  getCycles(): readonly CycleTrajectory[] {
    return this.#cycles;
  }

  /** Pair the two most recent distinct cycles (newest = B, previous = A). */
  pairForPreference(): TrajectoryPair | null {
    if (this.#cycles.length < 2) return null;
    const b = this.#cycles.at(-1)!;
    const a = this.#cycles.at(-2)!;
    const pa = this.#gradeOrder(a);
    const pb = this.#gradeOrder(b);
    if (Number.isNaN(pa) || Number.isNaN(pb))
      return { trajectoryA: a, trajectoryB: b, preference: 'SKIP' };
    const preference = pa === pb ? 'SKIP' : pa > pb ? 'A' : 'B';
    return { trajectoryA: a, trajectoryB: b, preference };
  }

  /** Grade ordering key: groundedness first (higher better), then mean risk (lower better). */
  #gradeOrder(c: CycleTrajectory): number {
    const g = c.grades?.groundedness;
    if (!g || g.abstained) return Number.NaN;
    const risks = c.grades?.risks.filter((r) => !r.abstained) ?? [];
    const meanRisk = risks.length ? risks.reduce((s, r) => s + r.score, 0) / risks.length : 0;
    return g.score * 10 - meanRisk;
  }
}
