/**
 * View presets — the four canonical perspectives that collapse renderer,
 * lens, layout, and channel selection into one click. The presets are the
 * L2 affordance; individual controls (lens, layout, channels) remain
 * reachable via the palette (L3) for power users.
 */

import {
  $activeLens,
  $activeRenderer,
  $lensLayout,
  $layoutScope,
  $capabilityFilter,
} from '../core/store.js';
import { LENS_IDS } from '../utils/lens-catalog.js';
import { layoutRegistry } from '../utils/layout-registry.js';
import { CHANNEL_IDS } from '../utils/lens-catalog.js';

/** The canonical view presets — the L2 ladder rung. */
export type ViewPresetId = 'ask' | 'explore' | 'read' | 'plan';

export interface ViewPreset {
  readonly id: ViewPresetId;
  readonly label: string;
  readonly description: string;
  readonly renderer: string;
  readonly lens: string;
  readonly layout: string;
  readonly scope: 'concept' | 'conversation';
  /** Channels to enable for this preset. */
  readonly channels: readonly string[];
}

/** The four canonical presets — the L2 ladder rung. */
export const VIEW_PRESETS: readonly ViewPreset[] = [
  {
    id: 'ask',
    label: 'Ask',
    description: 'Chat with the LM; submit questions, get answers, steer with prose.',
    renderer: 'notebook',
    lens: 'belief',
    layout: 'conversation',
    scope: 'conversation',
    channels: ['color', 'label', 'opacity'],
  },
  {
    id: 'explore',
    label: 'Explore',
    description: 'Navigate the concept graph; zoom, filter, trace derivations.',
    renderer: 'graph-2d',
    lens: 'belief',
    layout: 'cose',
    scope: 'concept',
    channels: ['color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z'],
  },
  {
    id: 'read',
    label: 'Read',
    description: 'Read the notebook; folded sections, citations, embedded views.',
    renderer: 'notebook',
    lens: 'belief',
    layout: 'conversation',
    scope: 'conversation',
    channels: ['color', 'label', 'opacity'],
  },
  {
    id: 'plan',
    label: 'Plan',
    description: 'Set goals, watch gates/budget/termination, steer autonomy.',
    renderer: 'graph-2d',
    lens: 'goal',
    layout: 'concentric',
    scope: 'concept',
    channels: ['color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z'],
  },
] as const;

/** Apply a preset by setting all relevant atoms. */
export function applyPreset(preset: ViewPreset): void {
  $activeRenderer.set(preset.renderer);
  $activeLens.set(preset.lens as 'belief' | 'goal' | 'contradiction' | 'temporal');
  $lensLayout.set({ ...$lensLayout.get(), [preset.lens]: preset.layout });
  $layoutScope.set(preset.scope);
  // Capability filter is not part of presets; user manages separately.
}

/** Get the current active preset id by matching current state (best effort). */
export function getActivePreset(): ViewPresetId | 'custom' {
  const renderer = $activeRenderer.get();
  const lens = $activeLens.get();
  const layout = $lensLayout.get()[$activeLens.get()];

  for (const preset of VIEW_PRESETS) {
    if (
      preset.renderer === renderer &&
      preset.lens === lens &&
      preset.layout === layout
    ) {
      return preset.id;
    }
  }
  return 'custom';
}

/** Get a preset by id. */
export function getPreset(id: ViewPresetId): ViewPreset {
  const preset = VIEW_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown view preset: ${id}`);
  return preset;
}

/** Available lenses for the lens picker (L3). */
export function availableLenses(): readonly string[] {
  return LENS_IDS;
}

/** Available layouts for the current scope. */
export function availableLayouts(scope: 'concept' | 'conversation'): readonly string[] {
  return layoutRegistry.layoutsFor(scope).map((l) => l.id);
}

/** Available channels (L3). */
export function availableChannels(): readonly string[] {
  return CHANNEL_IDS;
}