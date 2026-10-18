import type { TaskRecord } from '../task/record.js';
import { decodeState, encodeState, NAR_STATE_SCHEMA_VERSION } from './codec.js';

/**
 * The declared consistency boundary (CORE.19 C4.1, D14) — written down once, so
 * "does a restart resume the organism?" is a question about this list and not
 * about whatever the save path happened to serialize.
 *
 * Saved and restored:
 *  - concept tasks: term, type, truth, budget priority, stamp, occurrence time
 *  - concept priorities, as the attention surface reports them
 *  - drive intensities and the LM rule table
 *  - the kernel cycle counter
 *  - the pending task queue (tasks raised but not yet admitted to memory)
 *  - the id-minting high-water mark
 *  - RNG state, *when the NAR owns a `StatefulRandomSource`* (CORE.19 C4.1): the
 *    position word is round-tripped, so a resumed run continues the exact draw
 *    sequence. A caller-injected bare `RandomSource` has no position to save and
 *    the field is simply absent — declared, never a lied-about restore
 *  - the bounded gate-event ring: written through `GateEventLedger` (CORE.19
 *    C3.3) and, on `start()`, replayed into the in-memory rings (CORE.19 C4.3).
 *    The one piece of gate state the log implies — the action gate's autonomy
 *    mode, from the last replayed mode change — is restored with it, so the log
 *    and the gate cannot disagree after a restart
 *  - the derivation fire ring: written through `DerivationLedger` in its
 *    `derivation.accepted` form (no wall-clock, D13) and, on `start()`, replayed
 *    into `DerivationRecorder`'s ring (CORE.19 C4.3), so a restart resumes the
 *    fire records `getRuleFiresByConclusion` and `explainDerivation` read
 *
 * Deliberately omitted, never implied:
 *  - archive / forgetting internals, link caches and embedding caches
 *  - self-observability and metrics counters
 *  - the event-log position (derived by re-reading the log)
 */
export interface ConsistencyBoundary {
  /** The kernel cycle counter — a resumed run continues from N, not 0. */
  cycleCount: number;
  /** Tasks raised but not yet admitted when the save ran. */
  pendingTasks: TaskRecord[];
  /** The id-minting ledger, so a restart never re-stamps an id it already used. */
  idHighWater: number;
  /** The owned RNG's position word; absent when the source is stateless (C4.1). */
  rngState?: number;
}

export const EMPTY_BOUNDARY: ConsistencyBoundary = {
  cycleCount: 0,
  pendingTasks: [],
  idHighWater: 0,
};

/** The boundary file, written beside the task/drive files at the state path. */
export const BOUNDARY_FILENAME = 'nar-boundary.json';

const BOUNDARY_KIND = 'nar.boundary';

export const encodeBoundary = (boundary: ConsistencyBoundary): string =>
  encodeState(BOUNDARY_KIND, NAR_STATE_SCHEMA_VERSION, boundary);

/**
 * Decode the boundary file, refusing an unsupported schema version (the version
 * check lives in `decodeState`). A missing field is restored to its empty value
 * rather than implied — an old file restores zero cycles, not a guess.
 */
export const decodeBoundary = (text: string): ConsistencyBoundary => {
  const raw = decodeState<Partial<ConsistencyBoundary>>(
    text,
    BOUNDARY_KIND,
    NAR_STATE_SCHEMA_VERSION
  );
  return {
    cycleCount: raw.cycleCount ?? 0,
    pendingTasks: raw.pendingTasks ?? [],
    idHighWater: raw.idHighWater ?? 0,
    ...(raw.rngState !== undefined ? { rngState: raw.rngState } : {}),
  };
};
