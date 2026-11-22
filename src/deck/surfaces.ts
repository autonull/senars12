/**
 * Deck Surfaces — consolidated surface registry from UI (17 surfaces).
 *
 * This module re-exports the unified surface registry and provides
 * deck-specific views for the 17 registered surfaces.
 */

import type { SurfaceDescriptor, Placement } from '@senars/ui-shell/framework';

/**
 * Surface placement categories for deck views.
 */
export type DeckPlacement = 'viewport' | 'panel' | 'overlay' | 'inline';

/**
 * Surface group for deck organization.
 */
export interface SurfaceGroup {
  readonly placement: DeckPlacement;
  readonly surfaces: readonly SurfaceDescriptor[];
  readonly count: number;
}

/**
 * Consolidated surface registry view for deck.
 */
export interface DeckSurfaceRegistry {
  /** All registered surfaces. */
  readonly all: readonly SurfaceDescriptor[];
  /** Surfaces grouped by placement. */
  readonly byPlacement: Record<DeckPlacement, readonly SurfaceDescriptor[]>;
  /** Surface count by placement. */
  readonly counts: Record<DeckPlacement, number>;
  /** Total surface count. */
  readonly total: number;
}

/**
 * Create a deck surface registry from the unified surface registry.
 * This consolidates the 17 UI surfaces into deck views.
 */
export function createDeckSurfaceRegistry(surfaces: readonly SurfaceDescriptor[]): DeckSurfaceRegistry {
  const byPlacement = {
    viewport: surfaces.filter(s => s.placement === 'viewport'),
    panel: surfaces.filter(s => s.placement === 'panel'),
    overlay: surfaces.filter(s => s.placement === 'overlay'),
    inline: surfaces.filter(s => s.placement === 'inline'),
  } as Record<DeckPlacement, readonly SurfaceDescriptor[]>;

  const counts = {
    viewport: byPlacement.viewport.length,
    panel: byPlacement.panel.length,
    overlay: byPlacement.overlay.length,
    inline: byPlacement.inline.length,
  };

  return {
    all: surfaces,
    byPlacement,
    counts,
    total: surfaces.length,
  };
}

/**
 * Render a surface group as a deck panel.
 */
export function renderSurfaceGroup(group: SurfaceGroup): string {
  const lines = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `║ ${group.placement.toUpperCase()} SURFACES (${group.count})${' '.repeat(46 - group.placement.length - group.count.toString().length)}║`,
    `╠══════════════════════════════════════════════════════════════╣`,
  ];

  for (const surface of group.surfaces) {
    const tag = surface.tag ?? `s-${surface.id}`;
    const icon = surface.icon ?? '·';
    const label = surface.label ?? surface.title;
    lines.push(`║ ${icon} ${label.padEnd(20)} │ ${tag.padEnd(25)} ║`);
  }

  lines.push(`╚══════════════════════════════════════════════════════════════╝`);
  return lines.join('\n');
}

/**
 * Render the full deck surface registry.
 */
export function renderDeckSurfaces(registry: DeckSurfaceRegistry): string {
  const groups: SurfaceGroup[] = [
    { placement: 'viewport', surfaces: registry.byPlacement.viewport, count: registry.counts.viewport },
    { placement: 'panel', surfaces: registry.byPlacement.panel, count: registry.counts.panel },
    { placement: 'overlay', surfaces: registry.byPlacement.overlay, count: registry.counts.overlay },
    { placement: 'inline', surfaces: registry.byPlacement.inline, count: registry.counts.inline },
  ].filter(g => g.count > 0);

  const lines = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `║ DECK SURFACE REGISTRY — ${registry.total} SURFACES CONSOLIDATED${' '.repeat(31 - registry.total.toString().length)}║`,
    `╠══════════════════════════════════════════════════════════════╣`,
  ];

  for (const group of groups) {
    lines.push(renderSurfaceGroup(group));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get surfaces by capability requirement.
 */
export function surfacesByCapability(
  surfaces: readonly SurfaceDescriptor[],
  capability: string
): readonly SurfaceDescriptor[] {
  return surfaces.filter(s => s.capability === capability);
}

/**
 * Get surfaces by group.
 */
export function surfacesByGroup(
  surfaces: readonly SurfaceDescriptor[],
  group: string
): readonly SurfaceDescriptor[] {
  return surfaces.filter(s => s.group === group);
}