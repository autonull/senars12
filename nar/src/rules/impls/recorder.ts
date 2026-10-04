import type { DerivationRecord, DerivationStep, TruthValue } from '@senars/core/schemas';
import { asBeliefTruth, BoundedMap, BoundedRing, makeId, PushQueue, Signal } from '@senars/util';
import type { RuleInput, RuleResult } from '../types.js';

type Independence = DerivationStep['independence'];
type RuleCategory = DerivationStep['ruleCategory'];

/**
 * One row per category the derivation-record schema admits, keyed by that category
 * — so the vocabulary is the schema's union and the compiler answers whether every
 * category is reachable from a rule id, which the parallel list could not: it had
 * eleven rows over the same eleven names in a different order, and a miss fell
 * through to `logic` without saying so.
 */
const CATEGORY_KEYWORDS = {
  core: /revision|choice|structural-syllogism/,
  propositional: /negation|conjunction|disjunction/,
  comparison: /comparison|analogy/,
  classical: /modus|hypothetical|disjunctive/,
  structural: /composition|decomposition|conversion/,
  temporal: /temporal|sequence/,
  procedural: /operation|goal-achievement|procedure/,
  'meta-cognitive':
    /error-pattern|metacognitive|resource-allocation|strategy-effectiveness|self-model|utility-estimation|goal-execution/,
  variable: /variable|substitution|unification/,
  'higher-order': /higher-order/,
  logic: /deduction|induction|abduction|exemplification/,
} as const satisfies Record<RuleCategory, RegExp>;

const CATEGORY_PATTERNS = Object.entries(CATEGORY_KEYWORDS) as [RuleCategory, RegExp][];

/** How many distinct rule ids to remember; the table itself is the realistic bound. */
const RULE_ID_CACHE = 1024;

/**
 * Rule ids are loaded data, so the set is small and closed and the answer never
 * changes — but this ran a `toLowerCase` and up to eleven regex tests per
 * recorded derivation step, which is the field's hottest writer. Read with
 * `peek`: the answer should stay cached for the life of the table, not be
 * evicted by how often derivations mention it.
 */
const CATEGORY_BY_ID = new BoundedMap<string, RuleCategory>({ maxSize: RULE_ID_CACHE });

export function inferRuleCategory(ruleId: string): RuleCategory {
  const known = CATEGORY_BY_ID.peek(ruleId);
  if (known) return known;
  const key = ruleId.toLowerCase();
  const category = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(key))?.[0] ?? 'logic';
  CATEGORY_BY_ID.set(ruleId, category);
  return category;
}

const ancestorsOf = (input: RuleInput): Set<string> => {
  const set = new Set<string>();
  const stamp = input.stamp as { id?: unknown; derivations?: unknown } | undefined;
  if (stamp && typeof stamp.id === 'string') set.add(stamp.id);
  if (stamp && Array.isArray(stamp.derivations)) {
    for (const d of stamp.derivations) {
      if (typeof d === 'string') set.add(d);
    }
  }
  return set;
};

export interface RecorderOptions {
  maxStepsPerRecord?: number;
  maxCompletedRecords?: number;
  enabled?: boolean;
}

interface OpenRecord {
  derivationId: string;
  taskId: string;
  goalTerm: string;
  steps: DerivationStep[];
  stampToStep: Map<string, string>;
  maxDepth: number;
  cycles: number;
}

export class DerivationRecorder {
  private readonly maxStepsPerRecord: number;
  private readonly maxCompletedRecords: number;
  private enabled: boolean;
  private open: OpenRecord | null = null;
  private readonly completed: BoundedRing<DerivationRecord>;

  constructor(opts: RecorderOptions = {}) {
    this.maxStepsPerRecord = opts.maxStepsPerRecord ?? 200;
    this.maxCompletedRecords = opts.maxCompletedRecords ?? 200;
    this.completed = new BoundedRing(this.maxCompletedRecords);
    this.enabled = opts.enabled ?? false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Whether a record is being kept. The sweep reads it before serializing the first
   *  premise, which is the only thing `begin` needs and which the recorder itself
   *  would otherwise have thrown away. */
  get isRecording(): boolean {
    return this.enabled;
  }

  /**
   * Open a record for the rule sweep on one task. Only the task's Narsese form is
   * kept: a record names the goal it derived, and the premise identity a second
   * argument used to carry was discarded on arrival — built per premise pair, and
   * spent on nothing.
   */
  begin(goalTerm: string): void {
    if (!this.enabled) return;
    this.open = {
      derivationId: makeId(),
      taskId: makeId(),
      goalTerm,
      steps: [],
      stampToStep: new Map(),
      maxDepth: 0,
      cycles: 0,
    };
  }

  record(
    ruleId: string,
    p1: RuleInput,
    p2: RuleInput,
    result: RuleResult,
    truthFnName?: string
  ): void {
    if (!this.enabled || !this.open) return;
    if (this.open.steps.length >= this.maxStepsPerRecord) return;
    const stepId = makeId();
    const p1Ancestors = ancestorsOf(p1);
    const p2Ancestors = ancestorsOf(p2);
    let independence: Independence = 'independent';
    for (const a of p1Ancestors) {
      if (p2Ancestors.has(a)) {
        independence = 'dependent';
        break;
      }
    }
    const lineage = [...p1Ancestors, ...p2Ancestors]
      .map((a) => this.open?.stampToStep.get(a))
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 16);
    if (lineage.length === 0) lineage.push(this.open.taskId);
    const step: DerivationStep = {
      stepId,
      ruleId,
      ruleCategory: inferRuleCategory(ruleId),
      premises: [p1.term.toString(), p2.term.toString()],
      conclusion: result.term.toString(),
      truth: asBeliefTruth(result.truth),
      truthFn: truthFnName,
      premiseTruths: [asBeliefTruth(p1.truth), asBeliefTruth(p2.truth)],
      evidenceLineage: lineage,
      independence,
    };
    this.open.steps.push(step);
    const resultStamp = result.stamp as { id?: unknown } | undefined;
    if (resultStamp && typeof resultStamp.id === 'string')
      this.open.stampToStep.set(resultStamp.id, stepId);
    this.open.cycles++;
    this.open.maxDepth = Math.max(this.open.maxDepth, p1Ancestors.size + p2Ancestors.size);
  }

  finish(): DerivationRecord | null {
    if (!this.enabled || !this.open) {
      this.open = null;
      return null;
    }
    const open = this.open;
    this.open = null;
    if (open.steps.length === 0) return null;
    const last = open.steps[open.steps.length - 1]!;
    const record: DerivationRecord = {
      derivationId: open.derivationId,
      taskId: open.taskId,
      goalTerm: open.goalTerm,
      steps: open.steps,
      finalTruth: last.truth,
      totalCycles: open.cycles,
      maxDepthReached: open.maxDepth,
      timestamp: Date.now(),
      engine: 'nar',
    };
    this.completed.push(record);
    return record;
  }

  drain(): DerivationRecord[] {
    this.finish();
    const drained = this.completed.toArray();
    this.completed.clear();
    return drained;
  }

  pending(): number {
    return this.completed.size();
  }

  clear(): void {
    this.open = null;
    this.completed.clear();
  }
}

/**
 * Phase D (REFACTOR.todo1): bounded ring + push-based live subscription.
 * Zero-cost when nobody subscribes; each `stream()` call is an independent
 * consumer (tee) that replays the current ring before going live.
 */
export class ProofStreamRing<T> {
  readonly #items: BoundedRing<T>;
  readonly #listeners = new Signal<T>();

  constructor(private readonly capacity: number) {
    this.#items = new BoundedRing(capacity);
  }

  push(item: T): void {
    this.#items.push(item);
    this.#listeners.emit(item);
  }

  snapshot(limit = this.capacity): readonly T[] {
    return this.#items.tail(limit);
  }

  /** Live view: ring snapshot first, then pushed items; `return`/abort unsubscribes. */
  stream(signal?: AbortSignal): AsyncIterable<T> {
    // `PushQueue` is the canonical push→`for await` bridge: it seeds from the
    // ring snapshot, wakes waiters FIFO, and closes every waiter on unsubscribe.
    const queue = new PushQueue<T>();
    for (const item of this.#items.toArray()) queue.push(item);

    const unsubscribeListener = this.#listeners.on((item) => queue.push(item));

    const unsubscribe = (): void => {
      if (queue.closed) return;
      unsubscribeListener();
      queue.close();
    };
    signal?.addEventListener('abort', unsubscribe, { once: true });

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => queue.next(),
        return: async () => {
          unsubscribe();
          return { done: true as const, value: undefined };
        },
      }),
    };
  }
}
