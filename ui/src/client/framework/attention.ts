/**
 * Attention governs fidelity (§0, §16 Step 2, invariants 14–15).
 *
 * One allocator maps `(focus, attention weight) → fidelity tier`, and reclaims
 * fidelity by decay — the UI obeys AIKR the way the mind does. The tier ladder is
 * the existing LOD ladder (`glyph`→`label`→`card`→`full`), plus `reclaimed` (not
 * drawn): the allocator decides the *tier*, the viewport keeps its zoom→tier
 * thresholds unchanged, so this absorbs the LOD machinery rather than replacing it.
 */

import type { LoDTier } from '../utils/graph-scaling.js';
import { type FocusRef, focusKey } from './coordinates.js';

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
  return LADDER[Math.min(ceiling, Math.round(clamp01(weight) * ceiling))] ?? 'reclaimed';
};

/** Half-life of unattended attention, in ms. */
export const DEFAULT_HALF_LIFE_MS = 30_000;

/** Below this weight a focus is reclaimed — no longer drawn (invariant 14). */
export const RECLAIM_THRESHOLD = 0.05;

/** Weight after decaying over `elapsed` ms with an exponential half-life. */
export const decayWeight = (
  weight: number,
  elapsed: number,
  halfLife = DEFAULT_HALF_LIFE_MS
): number => (halfLife <= 0 ? 0 : weight * 2 ** (-Math.max(0, elapsed) / halfLife));

/** Attention cost per tier — richer fidelity is dearer, so it must be budgeted (invariant 15). */
export const TIER_COST: Readonly<Record<FidelityTier, number>> = {
  reclaimed: 0,
  glyph: 1,
  label: 2,
  card: 4,
  full: 8,
};

/** One focus's verdict for a frame. */
export interface Allocation {
  readonly focus: FocusRef;
  readonly attentionClass: AttentionClass;
  readonly weight: number;
  readonly tier: FidelityTier;
}

interface Entry {
  readonly key: string;
  readonly focus: FocusRef;
  readonly attentionClass: AttentionClass;
  weight: number;
  touchedAt: number;
}

/**
 * The attention field: the set of foci competing for this frame's fidelity. Attend
 * to raise a focus's weight; `allocate` decays every weight, reclaims the
 * unattended, and spends a finite budget richest-first.
 */
export class AttentionField {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly budget = 64,
    private readonly halfLifeMs = DEFAULT_HALF_LIFE_MS
  ) {}

  /** Raise a focus's weight (never lower it) and mark it just-seen. */
  attend(focus: FocusRef, attentionClass: AttentionClass, weight: number, now: number): void {
    const key = focusKey(focus);
    const existing = this.entries.get(key);
    const held = clamp01(weight);
    if (existing) {
      existing.weight = Math.max(existing.weight, held);
      existing.touchedAt = now;
      return;
    }
    this.entries.set(key, { key, focus, attentionClass, weight: held, touchedAt: now });
  }

  /** Forget a focus outright (e.g. it left the arrangement). */
  release(focus: FocusRef): void {
    this.entries.delete(focusKey(focus));
  }

  /** The decayed weight of a focus right now, or 0 if it is not attended. */
  weightOf(focus: FocusRef, now: number): number {
    const entry = this.entries.get(focusKey(focus));
    return entry ? decayWeight(entry.weight, now - entry.touchedAt, this.halfLifeMs) : 0;
  }

  /** The tier a focus would receive right now, ignoring the frame budget. */
  tierOf(focus: FocusRef, now: number): FidelityTier {
    const entry = this.entries.get(focusKey(focus));
    if (!entry) return 'reclaimed';
    const weight = decayWeight(entry.weight, now - entry.touchedAt, this.halfLifeMs);
    return weight < RECLAIM_THRESHOLD ? 'reclaimed' : tierFor(entry.attentionClass, weight);
  }

  /**
   * Decay, reclaim the unattended, and allocate the frame budget: sort live
   * entries by decayed weight, then give each the richest tier within its class
   * ceiling that the remaining budget affords. Foci that do not fit are reclaimed.
   */
  allocate(now: number): Allocation[] {
    const live: { entry: Entry; weight: number }[] = [];
    for (const entry of this.entries.values()) {
      const weight = decayWeight(entry.weight, now - entry.touchedAt, this.halfLifeMs);
      if (weight < RECLAIM_THRESHOLD) {
        this.entries.delete(entry.key);
        continue;
      }
      live.push({ entry, weight });
    }
    live.sort((a, b) => b.weight - a.weight);

    let remaining = this.budget;
    const allocations: Allocation[] = [];
    for (const { entry, weight } of live) {
      const desired = tierRank(tierFor(entry.attentionClass, weight));
      let tier: FidelityTier = 'reclaimed';
      for (let rank = desired; rank >= 0; rank -= 1) {
        const candidate = LADDER[rank] ?? 'reclaimed';
        if (TIER_COST[candidate] <= remaining) {
          tier = candidate;
          remaining -= TIER_COST[candidate];
          break;
        }
      }
      allocations.push({ focus: entry.focus, attentionClass: entry.attentionClass, weight, tier });
    }
    return allocations;
  }

  /** Forget every focus (e.g. on teardown / focus reset). */
  clear(): void {
    this.entries.clear();
  }
}
