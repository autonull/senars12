/**
 * Attention runtime — the per-frame loop that drives the UI attention field (§16 Step 4).
 *
 * A single AttentionField instance, a cycle-driven decay loop (tied to
 * `cognitive.delta` from the kernel), and the bridge from allocated tiers to
 * viewport zoom via `graph-scaling`'s thresholds. Consumers (graph viewport,
 * cell renderers) attend foci; the runtime ages and allocates on each cycle.
 *
 * Decay is driven by the kernel's cycle tick (§18.2) so UI and reasoner attention
 * age identically — the UI's `AttentionField` and the mind's `FocusBag` share
 * the same substrate (§0, §22).
 */

import { AttentionField, type Allocation, decayRateFor, type AttentionPolicy, attentionPolicyFromConfig } from './attention.js';
import { type FocusRef, MIND_FOCUS } from './coordinates.js';
import { LOD_ZOOM_THRESHOLDS } from '../utils/graph-scaling.js';
import { $config } from '../core/store.js';

/** The singleton attention field for this UI session. */
let fieldInstance: AttentionField | null = null;
let policy: AttentionPolicy | null = null;

/** Get or create the global attention field, using current UI config. */
export function getAttentionField(): AttentionField {
  if (!fieldInstance) {
    const config = $config.get();
    fieldInstance = AttentionField.fromConfig(config);
    policy = attentionPolicyFromConfig(config);
  }
  return fieldInstance;
}

/** Attend a focus with a given class and weight. */
export function attendFocus(focus: FocusRef, attentionClass: 'focus' | 'ring' | 'ambient', weight: number): void {
  getAttentionField().attend(focus, attentionClass, weight);
}

/** Release a focus from the attention field. */
export function releaseFocus(focus: FocusRef): void {
  fieldInstance?.release(focus);
}

/** The current allocated tier for a focus (after budget allocation). */
export function tierOf(focus: FocusRef): 'reclaimed' | 'glyph' | 'label' | 'card' | 'full' {
  return fieldInstance?.tierOf(focus) ?? 'reclaimed';
}

/** Decay the attention field by one cycle tick. */
export function decayAttentionField(cycleIntervalMs?: number): void {
  const field = getAttentionField();
  const currentPolicy = policy ?? { halfLifeMs: 30_000 } as AttentionPolicy;
  const elapsed = cycleIntervalMs ?? 1000; // default ~1s cycle
  field.decay(decayRateFor(elapsed, currentPolicy.halfLifeMs));
}

/** Initialize the attention runtime with config and subscribe to config changes. */
export function initAttentionRuntime(): void {
  const config = $config.get();
  fieldInstance = AttentionField.fromConfig(config);
  policy = attentionPolicyFromConfig(config);

  // Re-create field when attention config changes
  $config.subscribe((newConfig) => {
    const newPolicy = attentionPolicyFromConfig(newConfig);
    if (policy && policyChanged(policy, newPolicy)) {
      policy = newPolicy;
      fieldInstance = AttentionField.fromConfig(newConfig);
    }
  });
}

function policyChanged(a: AttentionPolicy, b: AttentionPolicy): boolean {
  return (
    a.halfLifeMs !== b.halfLifeMs ||
    a.capacity !== b.capacity ||
    a.reclaimThreshold !== b.reclaimThreshold ||
    a.tierCost.glyph !== b.tierCost.glyph ||
    a.tierCost.label !== b.tierCost.label ||
    a.tierCost.card !== b.tierCost.card ||
    a.tierCost.full !== b.tierCost.full
  );
}

/** Stop the attention runtime (for teardown/testing). */
export function stopAttentionRuntime(): void {
  fieldInstance?.clear();
  fieldInstance = null;
  policy = null;
}

/** Convert an allocated fidelity tier to a target zoom level. */
export function tierToZoom(tier: 'reclaimed' | 'glyph' | 'label' | 'card' | 'full'): number {
  switch (tier) {
    case 'reclaimed':
    case 'glyph':
      return LOD_ZOOM_THRESHOLDS.glyph;
    case 'label':
      return LOD_ZOOM_THRESHOLDS.label;
    case 'card':
      return LOD_ZOOM_THRESHOLDS.card;
    case 'full':
      return LOD_ZOOM_THRESHOLDS.full;
  }
}

/** The current frame's allocations — for debugging/inspection. */
export function currentAllocations(): Allocation[] {
  return fieldInstance?.allocate() ?? [];
}

/** A single weighted ambient sample — for the ambient layer (§13). */
export function sampleAmbient(): import('./attention.js').AttentionItem | undefined {
  return fieldInstance?.sample();
}

/** A budget of weighted ambient samples — for the ambient layer (§13). */
export function sampleAmbientMany(budget: number): import('./attention.js').AttentionItem[] {
  return fieldInstance?.sampleMany(budget) ?? [];
}

/** Reset the attention field (e.g. on workspace reset). */
export function resetAttentionField(): void {
  fieldInstance?.clear();
  fieldInstance = null;
  policy = null;
}

/** The ambient mind focus — always attended at ambient weight. */
export function attendMind(): void {
  attendFocus(MIND_FOCUS, 'ambient', 0.3);
}