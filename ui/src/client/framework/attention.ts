/**
 * Attention governs fidelity (§0, §16 Step 2, invariants 14–15).
 *
 * One allocator maps `(focus, attention weight) → fidelity tier`, and reclaims
 * fidelity by decay — the UI obeys AIKR the way the mind does. The substrate is
 * the *shared* AIKR bag (`@senars/util/bag`): the UI's field and the mind's
 * `FocusBag` are the same object seen through different renderers (§22). Decay
 * is fed per frame (`decay(rate)`) so attention ages identically in both; the
 * bag's `forgetRate` is the reclaim floor.
 *
 * The tier ladder is the existing LOD ladder (`glyph`→`label`→`card`→`full`),
 * plus `reclaimed` (not drawn): the allocator decides the *tier*, the viewport
 * keeps its zoom→tier thresholds unchanged, so this absorbs the LOD machinery
 * rather than replacing it.
 *
 * Policy (half-life, capacity, reclaim threshold, tier costs) comes from
 * `UiConfig.attention` (§0) so it can be tuned without code changes.
 */

import { type Bag, type BagItem, createBag } from '@senars/util/bag';
import type { LoDTier } from '../utils/graph-scaling.js';
import { type FocusRef, focusKey } from './coordinates.js';
import type { UiConfig } from '../core/config-schema.js';

/** The fidelity ladder: the LOD tiers, plus the reclaimed (not-drawn) floor. */
export type FidelityTier = 'reclaimed' | LoDTier;

/** The ladder, cheapest first. */
const LADDER: readonly FidelityTier[] = ['reclaimed', 'glyph', 'label', 'card', 'full'];

/** Position on the fidelity ladder (higher = richer). */
export const tierRank = (tier: FidelityTier): number => LADDER.indexOf(tier);

/** Where a focus sits relative to the subject: centre, ring, or field (§8). */
export type AttentionClass = 'focus' | 'ring' | 'ambient';

const CEILING: Readonly<Record<AttentionClass, FidelityTier>> = {
  focus: 'full',
  ring: 'label',
  ambient: 'glyph',
};

/** Classify by ring distance from the focus: 0 = focus, 1 = ring, ≥2 = ambient. */
export const classify = (distance: number): AttentionClass =>
  distance <= 0 ? 'focus' : distance === 1 ? 'ring' : 'ambient';

/** The richest the field will spend on a class, regardless of weight (invariant 14). */
export const tierCeiling = (attentionClass: AttentionClass): FidelityTier =>
  CEILING[attentionClass];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** The tier for a focus of a class at a weight; weight spends up to the class ceiling. */
export const tierFor = (attentionClass: AttentionClass, weight: number): FidelityTier => {
  const ceiling = tierRank(CEILING[attentionClass]);
  const w = clamp01(weight);
  // For ambient class, any positive weight must reach at least 'glyph' (rank 1)
  // Math.ceil ensures the ceiling is reached at weight=1, and any w>0 gives rank>=1
  const rank = w > 0 ? Math.max(1, Math.ceil(w * ceiling)) : 0;
  return LADDER[Math.min(ceiling, rank)] ?? 'reclaimed';
};

/** Default attention policy — used when config is not yet loaded. */
export const DEFAULT_ATTENTION_POLICY = {
  halfLifeMs: 30_000 as const,
  capacity: 64 as const,
  reclaimThreshold: 0.05 as const,
  tierCost: { glyph: 1 as const, label: 2 as const, card: 4 as const, full: 8 as const },
} as const;

export type AttentionPolicy = typeof DEFAULT_ATTENTION_POLICY;

/** Extract attention policy from UI config, falling back to defaults. */
export function attentionPolicyFromConfig(config?: UiConfig): AttentionPolicy {
  if (!config?.attention) return DEFAULT_ATTENTION_POLICY;
  const a = config.attention;
  return {
    halfLifeMs: a.halfLifeMs ?? DEFAULT_ATTENTION_POLICY.halfLifeMs,
    capacity: a.capacity ?? DEFAULT_ATTENTION_POLICY.capacity,
    reclaimThreshold: a.reclaimThreshold ?? DEFAULT_ATTENTION_POLICY.reclaimThreshold,
    tierCost: {
      glyph: a.tierCost?.glyph ?? DEFAULT_ATTENTION_POLICY.tierCost.glyph,
      label: a.tierCost?.label ?? DEFAULT_ATTENTION_POLICY.tierCost.label,
      card: a.tierCost?.card ?? DEFAULT_ATTENTION_POLICY.tierCost.card,
      full: a.tierCost?.full ?? DEFAULT_ATTENTION_POLICY.tierCost.full,
    },
  } as AttentionPolicy;
}

/** Half-life of unattended attention, in ms. */
export const DEFAULT_HALF_LIFE_MS = DEFAULT_ATTENTION_POLICY.halfLifeMs;

/** The default number of foci the field will hold at once. */
export const DEFAULT_ATTENTION_CAPACITY = DEFAULT_ATTENTION_POLICY.capacity;

/** Below this weight a focus is reclaimed — no longer drawn (invariant 14). */
export const RECLAIM_THRESHOLD = DEFAULT_ATTENTION_POLICY.reclaimThreshold;

/** Weight after decaying over `elapsed` ms with an exponential half-life. */
export const decayWeight = (
  weight: number,
  elapsed: number,
  halfLife = DEFAULT_HALF_LIFE_MS
): number => (halfLife <= 0 ? 0 : weight * 2 ** (-Math.max(0, elapsed) / halfLife));

/**
 * The retention the bag sheds per frame: the share of weight that decays over
 * `elapsedMs` at `halfLifeMs`, which is `1 - 2^(-elapsed/halfLife)`. The bag
 * multiplies by `1 - rate`, so this is the half-life expressed for its `decay`.
 */
export const decayRateFor = (elapsedMs: number, halfLifeMs = DEFAULT_HALF_LIFE_MS): number =>
  halfLifeMs <= 0 ? 1 : 1 - 2 ** (-Math.max(0, elapsedMs) / halfLifeMs);

/** Attention cost per tier — richer fidelity is dearer, so it must be budgeted (invariant 15). */
export const TIER_COST: Readonly<Record<FidelityTier, number>> = {
  reclaimed: 0,
  glyph: DEFAULT_ATTENTION_POLICY.tierCost.glyph,
  label: DEFAULT_ATTENTION_POLICY.tierCost.label,
  card: DEFAULT_ATTENTION_POLICY.tierCost.card,
  full: DEFAULT_ATTENTION_POLICY.tierCost.full,
};

/** One focus's verdict for a frame. */
export interface Allocation {
  readonly focus: FocusRef;
  readonly attentionClass: AttentionClass;
  readonly weight: number;
  readonly tier: FidelityTier;
}

/**
 * One focus's entry in the bag: `id` = `focusKey(focus)`, `priority` = the
 * attention weight the bag orders and decays, plus the class the renderer reads.
 */
export interface AttentionItem extends BagItem {
  readonly attentionClass: AttentionClass;
  readonly focus: FocusRef;
}

/**
 * The attention field: the set of foci competing for this frame's fidelity. It
 * *is* an AIKR bag — `attend` raises a focus's priority, `decay` ages the whole
 * field, and `allocate` spends a finite budget richest-first. The bag forgets a
 * focus the moment its weight falls below the reclaim floor.
 */
export class AttentionField {
  private readonly bag: Bag<AttentionItem>;
  private readonly reclaimThreshold: number;
  private readonly tierCost: Readonly<Record<FidelityTier, number>>;
  private readonly budget: number;

  /**
   * Create an AttentionField. Supports two signatures:
   * - `new AttentionField(config?, budgetOverride?)` — from UI config (preferred)
   * - `new AttentionField(budget, capacity, reclaimThreshold?, tierCost?)` — legacy/test signature
   */
  constructor(
    configOrBudget: UiConfig | number,
    budgetOrCapacity?: number,
    reclaimThreshold?: number,
    tierCost?: Readonly<Record<FidelityTier, number>>
  ) {
    if (typeof configOrBudget === 'number') {
      // Legacy signature: (budget, capacity, reclaimThreshold?, tierCost?)
      const budget = configOrBudget;
      const capacity = budgetOrCapacity ?? budget;
      this.reclaimThreshold = reclaimThreshold ?? DEFAULT_ATTENTION_POLICY.reclaimThreshold;
      this.tierCost = tierCost ?? TIER_COST;
      this.budget = budget;
      this.bag = createBag<AttentionItem>({ capacity, forgetRate: this.reclaimThreshold });
    } else {
      // Config signature: (config?, budgetOverride?)
      const config = configOrBudget;
      const budgetOverride = budgetOrCapacity;
      const policy = attentionPolicyFromConfig(config);
      this.budget = budgetOverride ?? policy.capacity;
      this.reclaimThreshold = policy.reclaimThreshold;
      this.tierCost = {
        reclaimed: 0,
        glyph: policy.tierCost.glyph,
        label: policy.tierCost.label,
        card: policy.tierCost.card,
        full: policy.tierCost.full,
      };
      this.bag = createBag<AttentionItem>({ capacity: policy.capacity, forgetRate: this.reclaimThreshold });
    }
  }

  /** Create an AttentionField from UI config (explicit static method). */
  static fromConfig(config?: UiConfig, budgetOverride?: number): AttentionField {
    return new AttentionField(config ?? ({} as UiConfig), budgetOverride);
  }

  /** Raise a focus's weight (never lower it), re-seating it in the bag. */
  attend(focus: FocusRef, attentionClass: AttentionClass, weight: number): void {
    const id = focusKey(focus);
    const held = clamp01(weight);
    const existing = this.bag.find((item) => item.id === id);
    if (existing) {
      if (held <= existing.priority) return;
      this.bag.remove(id);
    }
    this.bag.add({ id, priority: held, attentionClass, focus });
  }

  /** Forget a focus outright (e.g. it left the arrangement). */
  release(focus: FocusRef): void {
    this.bag.remove(focusKey(focus));
  }

  /** The current weight of a focus, or 0 if it is not attended. */
  weightOf(focus: FocusRef): number {
    const id = focusKey(focus);
    return this.bag.find((item) => item.id === id)?.priority ?? 0;
  }

  /** The tier a focus would receive right now, ignoring the frame budget. */
  tierOf(focus: FocusRef): FidelityTier {
    const id = focusKey(focus);
    const item = this.bag.find((entry) => entry.id === id);
    if (!item || item.priority < this.reclaimThreshold) return 'reclaimed';
    return tierFor(item.attentionClass, item.priority);
  }

  /** Age the whole field: the bag decays every weight and forgets those below the floor. */
  decay(rate?: number): void {
    this.bag.decay(rate);
  }

  /**
   * Allocate the frame budget: the bag already yields foci priority-descending,
   * so give each the richest tier within its class ceiling the remaining budget
   * affords. Foci that do not fit are reclaimed; the rest are not drawn.
   */
  allocate(): Allocation[] {
    let remaining = this.budget;
    const allocations: Allocation[] = [];
    for (const item of this.bag.all()) {
      if (item.priority < this.reclaimThreshold) continue;
      const desired = tierRank(tierFor(item.attentionClass, item.priority));
      let tier: FidelityTier = 'reclaimed';
      for (let rank = desired; rank >= 0; rank -= 1) {
        const candidate = LADDER[rank] ?? 'reclaimed';
        if (this.tierCost[candidate] <= remaining) {
          tier = candidate;
          remaining -= this.tierCost[candidate];
          break;
        }
      }
      allocations.push({
        focus: item.focus,
        attentionClass: item.attentionClass,
        weight: item.priority,
        tier,
      });
    }
    return allocations;
  }

  /** The ambient layer's weighted pick (§13) — the bag's sampling, seen through the field. */
  sample(): AttentionItem | undefined {
    return this.bag.sample();
  }

  /** A budget of ambient samples — the bag's weighted drain (§11/§13). */
  sampleMany(budget: number): AttentionItem[] {
    return this.bag.sampleMany(budget);
  }

  /** Forget every focus (e.g. on teardown / focus reset). */
  clear(): void {
    this.bag.clear();
  }
}
