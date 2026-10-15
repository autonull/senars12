/**
 * Attention runtime — the per-frame loop that drives the UI attention field (§16 Step 4).
 *
 * A single AttentionField instance, a frame loop that calls `decay`, and the
 * bridge from allocated tiers to viewport zoom via `graph-scaling`'s thresholds.
 * Consumers (graph viewport, cell renderers) attend foci; the runtime ages and
 * allocates once per frame.
 */

import { AttentionField, type Allocation, DEFAULT_HALF_LIFE_MS, decayRateFor, tierFor } from './attention.js';
import { type FocusRef, focusKey, MIND_FOCUS } from './coordinates.js';
import { LOD_ZOOM_THRESHOLDS } from '../utils/graph-scaling.js';

/** The singleton attention field for this UI session. */
let fieldInstance: AttentionField | null = null;
let lastFrameTime = 0;
let animationFrameId: number | null = null;

/** Get or create the global attention field. */
export function getAttentionField(): AttentionField {
  if (!fieldInstance) {
    fieldInstance = new AttentionField();
    startFrameLoop();
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

/** Start the per-frame decay loop. */
function startFrameLoop(): void {
  if (animationFrameId !== null) return;
  lastFrameTime = performance.now();
  const loop = (now: number) => {
    const dt = now - lastFrameTime;
    lastFrameTime = now;
    if (fieldInstance) {
      fieldInstance.decay(decayRateFor(dt, DEFAULT_HALF_LIFE_MS));
    }
    animationFrameId = requestAnimationFrame(loop);
  };
  animationFrameId = requestAnimationFrame(loop);
}

/** Stop the frame loop (for teardown/testing). */
export function stopFrameLoop(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
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
  stopFrameLoop();
}

/** The ambient mind focus — always attended at ambient weight. */
export function attendMind(): void {
  attendFocus(MIND_FOCUS, 'ambient', 0.3);
}