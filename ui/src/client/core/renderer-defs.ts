/**
 * The one definition per `RendererId` (Track D4): every facet a renderer kind
 * carries — its label, the capability matrix it supports, declared parity, the
 * surface element it presents, and optional shell controls — lives on one record.
 * The catalog is the source of the `RendererId` union: `keyof typeof
 * RENDERER_DEFS`, so adding a renderer is one entry and no hand union to edit.
 */

import type { Capability } from './capabilities.js';
import type { WorkspaceInteraction } from './workspace-renderer.js';
import type { Channel } from '../modulation/types.js';
import { defineCatalog } from '../framework/catalog.js';

const channels = (...names: Channel[]): ReadonlySet<Channel> => new Set(names);

export const RENDERER_DEFS = defineCatalog({
  '2d': {
    label: '2D Graph',
    icon: 'graph-2d',
    capabilities: {
      node: channels('color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z'),
      edge: channels('color', 'edge-color', 'width', 'line-style', 'opacity'),
    },
    parity: 'full' as const,
    surface: 'graph-surface',
    controls: ['layers'],
    interactions: [
      'compose',
      'stream',
      'artifacts',
      'inspect',
      'explain',
      'select-context',
      'follow-up',
      'steer',
      'run-control',
      'palette',
      'structure-nav',
      'embed',
    ],
  },
  '3d': {
    label: '3D Graph',
    icon: 'graph-3d',
    capabilities: {
      node: channels('color', 'opacity', 'size', 'label', 'z'),
      edge: channels('color', 'edge-color', 'width', 'opacity'),
    },
    parity: 'partial' as const,
    surface: 'graph3d-surface',
    interactions: [
      'compose',
      'stream',
      'inspect',
      'select-context',
      'palette',
      'structure-nav',
    ],
  },
} as const);

/** The semantic id of a workspace renderer — the catalog keys are its source (D4). */
export type RendererId = keyof typeof RENDERER_DEFS.definition;

/** Every renderer id, in catalog order. */
export const RENDERER_IDS = RENDERER_DEFS.ids;

export type RendererEntry = typeof RENDERER_DEFS.definition[RendererId];

export const rendererDef = (id: RendererId): RendererEntry => RENDERER_DEFS.get(id);

/** The renderers a facet selects, in catalog order — the one way a partial set is read. */
export const rendererIdsWhere = (facet: (def: RendererEntry) => boolean): RendererId[] =>
  RENDERER_DEFS.where(facet);