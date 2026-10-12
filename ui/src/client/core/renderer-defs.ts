/**
 * The one definition per `RendererId` (Track D4): every facet a renderer kind
 * carries — its label, the capability matrix it supports, declared parity, the
 * surface element it presents, and optional shell controls — lives on one record.
 * The catalog is the source of the `RendererId` union: `keyof typeof
 * RENDERER_DEFS`, so adding a renderer is one entry and no hand union to edit.
 *
 * `d()` defaults every facet, so a new renderer names only what it is; an
 * unknown facet key is an excess-property error against `RendererDef`.
 */

import type { Capability } from './capabilities.js';
import type { WorkspaceInteraction } from './workspace-renderer.js';
import type { Channel } from '../modulation/types.js';

export interface RendererDef {
  /** Human label for palette and toolbar. */
  readonly label: string;
  /** Icon name for palette/toolbar (matches `s-icon` names). */
  readonly icon: string;
  /** The modulation channel matrix this renderer supports. */
  readonly capabilities: Readonly<{
    readonly node: ReadonlySet<Channel>;
    readonly edge: ReadonlySet<Channel>;
  }>;
  /** Honest parity declaration: `full` or `partial`. */
  readonly parity: 'full' | 'partial';
  /** The custom-element tag that renders this viewport. */
  readonly surface: string;
  /** Capability required to use this renderer; absent = always available. */
  readonly requiredCapability?: Capability;
  /** Optional shell controls this renderer presents (e.g. `layers`). */
  readonly controls?: readonly string[];
  /** Interactions this renderer declares it implements. */
  readonly interactions?: readonly WorkspaceInteraction[];
}

const channels = (...names: Channel[]): ReadonlySet<Channel> => new Set(names);

const d = (
  label: string,
  facets: Partial<Omit<RendererDef, 'label'>> = {}
): RendererDef => ({
  label,
  icon: 'renderer',
  capabilities: { node: channels(), edge: channels() },
  parity: 'full',
  surface: 's-panel',
  ...facets,
});

export const RENDERER_DEFS = {
  '2d': d('2D Graph', {
    icon: 'graph-2d',
    capabilities: {
      node: channels('color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z'),
      edge: channels('color', 'edge-color', 'width', 'line-style', 'opacity'),
    },
    parity: 'full',
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
  }),
  '3d': d('3D Graph', {
    icon: 'graph-3d',
    capabilities: {
      node: channels('color', 'opacity', 'size', 'label', 'z'),
      edge: channels('color', 'edge-color', 'width', 'opacity'),
    },
    parity: 'partial',
    surface: 'graph3d-surface',
    interactions: [
      'compose',
      'stream',
      'inspect',
      'select-context',
      'palette',
      'structure-nav',
    ],
  }),
} as const satisfies Record<string, RendererDef>;

/** The semantic id of a workspace renderer — the catalog keys are its source (D4). */
export type RendererId = keyof typeof RENDERER_DEFS;

/** Every renderer id, in catalog order. */
export const RENDERER_IDS = Object.keys(RENDERER_DEFS) as readonly RendererId[];

export const rendererDef = (id: RendererId): RendererDef => RENDERER_DEFS[id];

/** The renderers a facet selects, in catalog order — the one way a partial set is read. */
export const rendererIdsWhere = (facet: (def: RendererDef) => boolean): RendererId[] =>
  RENDERER_IDS.filter((id) => facet(RENDERER_DEFS[id]));