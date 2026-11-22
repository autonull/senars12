/**
 * Autonomy NAR port — the subset of NAR that AutonomyHeartbeat needs.
 * Extracted to break nar.ts <-> autonomy/wiring.ts cycle.
 */

import type { Concept } from '../memory/concept';
import type { NarEventBus } from '../types/events';
import type { TaskType, TruthType } from '../types';
import type { Term } from '../terms';
import type { AutonomyConfigInput } from './config';
import type { Clock } from '@senars/util/clock';

export interface AutonomyNAR {
  getCycleCount(): number;
  getConfig(): {
    autonomy?: AutonomyConfigInput;
    clock?: Clock;
  };
  step(signal?: AbortSignal, correlationId?: string): Promise<number>;
  memory: {
    capacityPressure(): number;
    consolidate(options?: { cycleCount?: number }): void;
    evictionReport(): { archived: number; forgotten: number } | undefined;
  };
  listConcepts(): Concept[];
  input(input: string | Term, type?: TaskType, truth?: TruthType, correlationId?: string): Promise<void>;
  checkpointConsolidation(cycle: number): void;
  getEventBus(): NarEventBus;
}