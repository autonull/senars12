/**
 * Identifier minting — the one place a fresh id enters the system.
 *
 * Both functions here used to live in `shared.ts` with `makeId` hardcoded to
 * `crypto.randomUUID`, so a seeded run stamped unpredictable ids into its own
 * event log: `rng` fixed the draws while the *names* the draws were recorded
 * under stayed ambient. The seam is process-scoped rather than a parameter on 38
 * call sites because ids are minted deep in the gates, the task manager and the
 * concept store, none of which receives a NAR config — and `NAR` already owns
 * the process for its lifetime. The invariant is one seeded NAR per process,
 * which the determinism gate and the replay CLI already assume.
 */

/** Mints one fresh identifier. */
export type IdSource = () => string;

const ambient: IdSource = () => crypto.randomUUID();

let current: IdSource = ambient;

/** How many ids the installed source has minted — the ledger `generateId` appends to. */
let minted = 0;

/**
 * Install `source` as the process id source and return a restore function.
 * Passing nothing restores ambient entropy.
 */
export const installIdSource = (source?: IdSource): (() => void) => {
  const previous = current;
  current = source ?? ambient;
  return () => {
    current = previous;
  };
};

/** A fresh UUID, or the installed source's id when one is set. */
export const makeId = (): string => {
  minted++;
  return current();
};

/**
 * Counter-derived UUIDs, for seeded runs: `00000000-0000-4000-8000-000000000001`
 * and up. UUID-shaped rather than `evt-1` because `CognitiveEventSchema`
 * validates `taskId` as a UUID at the untrusted boundary, and because a replay
 * trace then reads the same as the live one it replaces.
 */
export const sequentialIdSource = (): IdSource => {
  let n = 0;
  return () => {
    const hex = (++n).toString(16).padStart(32, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  };
};

/**
 * Monotonic, collision-resistant id. Pass an injectable `rng` (seeded runs,
 * deterministic replay) — the default source is the global `Math.random`.
 */
export function generateId(prefix: string, rng: () => number = Math.random): string {
  return `${prefix}-${minted}-${rng().toString(36).slice(2, 6)}`;
}
