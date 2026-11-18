/**
 * Autonomy NAR port — the subset of NAR that AutonomyHeartbeat needs.
 * Extracted to break nar.ts <-> autonomy/wiring.ts cycle.
 */

import type { Concept } from '../memory/concept.js';

export interface AutonomyNAR {
  getCycleCount(): number;
  getConfig(): {
    autonomy: unknown;
    clock?: () => number;
  };
  step(): Promise<void>;
  memory: {
    capacityPressure(): number;
    consolidate(options: { cycleCount: number }): Promise<void>;
    evictionReport(): unknown;
  };
  listConcepts(): Concept[];
  input(narsese: string, type: 'question', truth?: unknown, correlationId?: string): Promise<void>;
  checkpointConsolidation(cycle: number): Promise<void>;
  getEventBus(): {
    emit(event: string, data: unknown): void;
  };
}