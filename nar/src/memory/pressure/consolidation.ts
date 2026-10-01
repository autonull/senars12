import { sortBy } from '@senars/util';
import { PRESSURE } from '../../constants.js';
import type { ConceptWriter, StatisticsView, SymbolIndex } from '../ports/index.js';

/**
 * Share of the idle population shed per cycle, by how far past the rung
 * occupancy currently sits. Eviction is proportional to the overshoot rather
 * than fixed so that a store held just above `PRESSURE.ARCHIVE` sheds a trickle
 * and a store driven to capacity sheds hard.
 */
const ARCHIVE_SHARE = 0.3;
const FORGET_SHARE = 0.2;

/**
 * The archive/forget policy — the only place concepts leave the live store
 * under pressure. `Memory.consolidate` delegates here rather than carrying a
 * second copy of the thresholds, so eviction and health cannot disagree about
 * whether the store is under pressure.
 *
 * Archive at `PRESSURE.ARCHIVE`, harden into irreversible removal at
 * `PRESSURE.CRITICAL`. Only concepts carrying no tasks are eligible: a concept
 * with an outstanding task has not been answered, so it is not debris.
 */
export const evictUnderPressure = (
  memory: StatisticsView & SymbolIndex & ConceptWriter
): { archived: number; forgotten: number } => {
  const pressure = memory.capacityPressure();
  if (pressure <= PRESSURE.ARCHIVE) return { archived: 0, forgotten: 0 };

  const idle = sortBy(
    memory.listConcepts().filter((c) => c.totalTasks === 0),
    (c) => c.priority
  );
  if (idle.length === 0) return { archived: 0, forgotten: 0 };

  const archiveCount = Math.ceil(
    idle.length * Math.min(ARCHIVE_SHARE, pressure - PRESSURE.NEUTRAL)
  );
  const forgetCount =
    pressure > PRESSURE.CRITICAL
      ? Math.ceil(idle.length * Math.min(FORGET_SHARE, pressure - PRESSURE.ARCHIVE))
      : 0;

  const archived = idle.slice(0, archiveCount).filter((c) => memory.archiveConcept(c)).length;
  const forgotten = idle
    .slice(archiveCount, archiveCount + forgetCount)
    .filter((c) => memory.removeConcept(c.term)).length;

  return { archived, forgotten };
};
