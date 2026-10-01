import { sortBy } from '@senars/util';
import { PRESSURE } from '../../constants.js';
import type { Concept } from '../concept.js';
import type { ConceptWriter, StatisticsView, SymbolIndex } from '../ports/index.js';

/**
 * Share of the idle population shed per cycle, by how far past the rung
 * occupancy currently sits. Eviction is proportional to the overshoot rather
 * than fixed so that a store held just above `PRESSURE.ARCHIVE` sheds a trickle
 * and a store driven to capacity sheds hard.
 */
const ARCHIVE_SHARE = 0.3;
const FORGET_SHARE = 0.2;

/** Attention a concept holding outstanding tasks is credited with, relative to one holding none. */
const TASK_VALUE = 1;

/**
 * What an eviction pass did. **A pass that freed nothing says so**, because a
 * silent `{ archived: 0, forgotten: 0 }` is indistinguishable from a pass that
 * never ran — and the case that matters is the worst one: a store at capacity
 * with nothing eligible, which is a condition an operator must see.
 *
 * - `within-capacity` — nothing to do; the store is below the archive rung.
 * - `evicted` — at least one concept left the live store.
 * - `exhausted` — at or above a rung, and the policy could act on nothing.
 */
export type EvictionReason = 'within-capacity' | 'evicted' | 'exhausted';

/** What a pass shed, and whether it could have shed more. */
export interface EvictionReport {
  readonly reason: EvictionReason;
  /** Concepts moved to the archive — recoverable. */
  readonly archived: number;
  /** Concepts removed outright — not recoverable. */
  readonly forgotten: number;
  /** How many of the forgotten were carrying tasks, shed only once nothing idle remained. */
  readonly taskHolders: number;
  /** The population the pass was choosing from, for a store that freed nothing. */
  readonly candidates: number;
  /** The idle subset — the only population that may be *archived* rather than forgotten. */
  readonly idle: number;
}

/**
 * Value of one concept: its attention plus a credit for outstanding tasks.
 *
 * The credit is what makes the ranking non-degenerate. Ranked by attention alone,
 * a concept holding fifty tasks and one holding none with the same attention are
 * indistinguishable, and the pass would shed by tie-break rather than by cost.
 */
export const conceptValue = (concept: Concept): number =>
  concept.priority + (concept.totalTasks > 0 ? TASK_VALUE : 0);

/**
 * Eviction order: **oldest first, least valuable to break a tie.** A concept must
 * be able to age out *while holding tasks* (§5.8), and the cheapest one to lose
 * is the old one worth least.
 *
 * **Not a product, and §5.8's "age × value" is why.** Attention is 0 for a
 * concept nothing has touched, so `age × value` is 0 for exactly the concepts
 * that are cheapest to shed — and it ranks a *fresh* worthless concept as cheap
 * as an ancient one, which re-creates the defect the item removes by another
 * route. A product cannot say "cheap only when *both* terms are low"; it says
 * "cheap when either is". A two-level comparison can, and it needs no weight.
 *
 * The weight that would collapse this into one number is **not** invented here:
 * §11.2 assigns "the retention weights" to TODO30 §7, and a magic constant chosen
 * in this commit would be a tuning decision made in the middle of a refactor.
 *
 * Age is measured from the last **write**, not the last read — A4 made reads
 * observational, so `lastAccessedAt` moves when the store is changed and reading
 * the store does not make a concept look younger (which would have made a
 * sampler a retention policy). It is a difference between two stamps from the
 * same store's own clock, so the *ordering* is a function of write order rather
 * than of when the run happened.
 */
export const evictionOrder = (a: Concept, b: Concept): number =>
  a.lastAccessedAt - b.lastAccessedAt || conceptValue(a) - conceptValue(b);

/**
 * The archive/forget policy — the only place concepts leave the live store
 * under pressure. `Memory.consolidate` delegates here rather than carrying a
 * second copy of the thresholds, so eviction and health cannot disagree about
 * whether the store is under pressure.
 *
 * Two stages, and the order is the policy:
 *
 * 1. **Archive** the lowest-value concepts carrying no tasks, from
 *    `PRESSURE.ARCHIVE`. Only concepts with no outstanding task are eligible: a
 *    concept with an unanswered task has not been debris, and archiving it would
 *    hide the question rather than shed the cost.
 * 2. **Forget**, above `PRESSURE.CRITICAL`, from what stage 1 left — *including
 *    concepts holding tasks*, ranked by age × value. Before this item the
 *    candidate set was `totalTasks === 0`, which made the filter
 *    anti-correlated with pressure: the busier the store, the fewer things
 *    eviction could reach, so a store could sit at capacity with a policy that
 *    provably could not act. A store at capacity with nothing shed reports
 *    `exhausted` rather than returning zeroes.
 */
export const evictUnderPressure = (
  memory: StatisticsView & SymbolIndex & ConceptWriter
): EvictionReport => {
  const pressure = memory.capacityPressure();
  const population = memory.listConcepts();
  if (pressure <= PRESSURE.ARCHIVE)
    return {
      reason: 'within-capacity',
      archived: 0,
      forgotten: 0,
      taskHolders: 0,
      candidates: population.length,
      idle: 0,
    };

  const idle = sortBy(
    population.filter((concept) => concept.totalTasks === 0),
    (concept) => conceptValue(concept)
  );

  const archiveTarget = Math.min(
    idle.length,
    Math.ceil(idle.length * Math.min(ARCHIVE_SHARE, pressure - PRESSURE.NEUTRAL))
  );
  const archivedNow = idle.slice(0, archiveTarget);
  const archivedSet = new Set(archivedNow);
  const archived = archivedNow.filter((concept) => memory.archiveConcept(concept)).length;

  // Above CRITICAL the remaining population is fair game, tasks and all. Below
  // it nothing is forgotten — only archived, which is recoverable.
  if (pressure <= PRESSURE.CRITICAL)
    return {
      reason: archived > 0 ? 'evicted' : 'exhausted',
      archived,
      forgotten: 0,
      taskHolders: 0,
      candidates: population.length,
      idle: idle.length,
    };

  // What stage 1 left, by age × value. Archived concepts are already out of the
  // store, so they are not candidates; the ones the archive refused to take are.
  const remainder = [
    ...population.filter(
      (concept) => !archivedSet.has(concept) && memory.getConcept(concept.term) !== undefined
    ),
  ].sort(evictionOrder);

  const forgetTarget = Math.min(
    remainder.length,
    Math.ceil(remainder.length * Math.min(FORGET_SHARE, pressure - PRESSURE.ARCHIVE))
  );
  const victims = remainder.slice(0, forgetTarget);
  const forgotten = victims.filter((concept) => memory.removeConcept(concept.term)).length;
  const taskHolders = victims.filter((concept) => concept.totalTasks > 0).length;

  return {
    reason: archived + forgotten > 0 ? 'evicted' : 'exhausted',
    archived,
    forgotten,
    taskHolders,
    candidates: population.length,
    idle: idle.length,
  };
};
