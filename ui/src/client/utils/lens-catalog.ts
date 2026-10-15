/**
 * The one presentation registry for the lens vocabulary and the one validation
 * path for a lens definition. The controller, the designer, the store's layout
 * defaults and the layout registry read this instead of re-declaring labels,
 * colors, required capabilities or default layouts beside each consumer.
 *
 * Built-in presentation (label/description/color) comes from the core
 * `LENS_VOCABULARY`; the modulation and `requires` come from the core lens specs
 * (`builtinLensSpecs`). A guard test keeps the two in step with
 * `BUILTIN_LENS_IDS`; adding a built-in without a catalog row fails it.
 *
 * The catalog is the SSOT (D3): `LensId` derives from the keys of `LENS_DEFS`,
 * so adding a lens is one entry and no hand tuple to edit.
 *
 * Now implemented as a Facet catalog (P4 unification).
 */

import type { BuiltinLens, LensSpec } from '../../shared/lens-schema.js';
import { BUILTIN_LENS_IDS, builtinLensSpecs, LensSpecSchema, type LensSpec as LensSpecType } from '../../shared/lens-schema.js';
import { LENS_COLORS_HEX, LENS_DESCRIPTIONS, LENS_LABELS } from '../../shared/constants.js';
import type { Channel } from '../modulation/types.js';
import { theme } from './theme.js';
import { CHANNELS } from '../modulation/types.js';
import { defineCatalog } from '../framework/catalog.js';
import { defineFacetCatalog, createLensFacet, type FacetDescriptor, facetKeysByKind } from '../framework/facet.js';

/** Default layout per built-in lens — the one source `$lensLayout` seeds from. */
export const LENS_DEFAULT_LAYOUTS = {
  belief: 'cose',
  goal: 'concentric',
  contradiction: 'breadthfirst',
  temporal: 'preset',
} as const satisfies Record<BuiltinLens, string>;

/** Whether a built-in lens is offered as a primary viewport lens (vs. niche). */
export const LENS_PRIMARY = {
  belief: true,
  goal: true,
  contradiction: true,
  temporal: false,
} as const satisfies Record<BuiltinLens, boolean>;

const SPEC_BY_ID = new Map<string, LensSpecType>(builtinLensSpecs().map((spec) => [spec.id, spec]));

function specOf(id: BuiltinLens): LensSpecType {
  const spec = SPEC_BY_ID.get(id);
  if (!spec) throw new Error(`built-in lens '${id}' has no lens spec`);
  return spec;
}

/** Internal facet catalog for lenses — uses the unified Facet system (P4). */
const LENS_FACET_DEFS = defineFacetCatalog({
  belief: createLensFacet('belief', 'Belief', {
    description: LENS_DESCRIPTIONS.belief ?? 'Degree of belief in a statement.',
    color: LENS_COLORS_HEX.belief ?? theme.colors.accentCyan,
    defaultLayout: LENS_DEFAULT_LAYOUTS.belief,
    primary: LENS_PRIMARY.belief,
    spec: specOf('belief'),
    modulation: specOf('belief').modulation,
    requires: specOf('belief').requires,
  }),
  goal: createLensFacet('goal', 'Goal', {
    description: LENS_DESCRIPTIONS.goal ?? 'Active goals and their satisfaction.',
    color: LENS_COLORS_HEX.goal ?? theme.colors.accentCyan,
    defaultLayout: LENS_DEFAULT_LAYOUTS.goal,
    primary: LENS_PRIMARY.goal,
    spec: specOf('goal'),
    modulation: specOf('goal').modulation,
    requires: specOf('goal').requires,
  }),
  contradiction: createLensFacet('contradiction', 'Contradiction', {
    description: LENS_DESCRIPTIONS.contradiction ?? 'Contradictions detected in the workspace.',
    color: LENS_COLORS_HEX.contradiction ?? theme.colors.accentCyan,
    defaultLayout: LENS_DEFAULT_LAYOUTS.contradiction,
    primary: LENS_PRIMARY.contradiction,
    spec: specOf('contradiction'),
    modulation: specOf('contradiction').modulation,
    requires: specOf('contradiction').requires,
  }),
  temporal: createLensFacet('temporal', 'Temporal', {
    description: LENS_DESCRIPTIONS.temporal ?? 'Temporal ordering of events.',
    color: LENS_COLORS_HEX.temporal ?? theme.colors.accentCyan,
    defaultLayout: LENS_DEFAULT_LAYOUTS.temporal,
    primary: LENS_PRIMARY.temporal,
    spec: specOf('temporal'),
    modulation: specOf('temporal').modulation,
    requires: specOf('temporal').requires,
  }),
} as const);

/** The flat lens entry type (back-compat). */
export interface LensEntry extends Record<string, unknown> {
  readonly label: string;
  readonly id: string;
  readonly description: string;
  readonly color: string;
  readonly defaultLayout: string;
  readonly primary: boolean;
  readonly spec: LensSpecType;
}

/** Back-compat: the flat lens catalog for existing consumers. */
export const LENS_DEFS = (() => {
  const def: Record<string, LensEntry> = {};
  for (const id of LENS_FACET_DEFS.ids) {
    const f = LENS_FACET_DEFS.get(id);
    def[id] = {
      label: f.label,
      id: f.id,
      description: f.data.description as string,
      color: f.data.color as string,
      defaultLayout: f.data.defaultLayout as string,
      primary: f.data.primary as boolean,
      spec: f.data.spec as LensSpecType,
    };
  }
  return defineCatalog(def);
})();

/** The facet catalog for lenses (P4 unification). */
export const LENS_FACETS = LENS_FACET_DEFS;

/** The semantic id of a lens facet — the catalog keys are its source (P4). */
export type LensFacetId = keyof typeof LENS_FACET_DEFS.definition;

/** The lens facet entry type. */
export type LensFacetEntry = typeof LENS_FACET_DEFS.definition[LensFacetId];

/** The semantic id of a lens — the catalog keys are its source (D3). */
export type LensId = keyof typeof LENS_DEFS.definition;

/** Every lens id, in catalog order. */
export const LENS_IDS = LENS_DEFS.ids;

export const lensDef = (id: LensId): LensEntry => LENS_DEFS.get(id);

/** The lens ids a facet selects, in catalog order — the one way a partial set is read. */
export const lensIdsWhere = (facet: (def: LensEntry) => boolean): LensId[] =>
  LENS_DEFS.where(facet);

/** Back-compat aliases. */
export const LENS_CATALOG = LENS_DEFS.definition;
export const PRIMARY_LENSES: LensEntry[] = LENS_IDS.filter((id) => LENS_DEFS.get(id).primary).map((id) => LENS_DEFS.get(id)!);

export const lensMeta = (id: string): LensEntry | undefined => LENS_DEFS.get(id as LensId);

export const builtinLensSpec = (id: string): LensSpecType | undefined => lensMeta(id)?.spec;

/** The one validation path for a lens definition, shared by the designer and the store. */
export type LensValidation =
  | { readonly ok: true; readonly spec: LensSpecType }
  | { readonly ok: false; readonly error: string };

export function validateLens(input: unknown): LensValidation {
  const parsed = LensSpecSchema.safeParse(input);
  if (parsed.success) return { ok: true, spec: parsed.data as LensSpecType };
  return {
    ok: false,
    error: parsed.error.issues
      .map((issue) => `${String(issue.path.join('.'))}: ${issue.message}`)
      .join('; '),
  };
}

/** Where a channel applies — the designer groups and annotates its options from this. */
export type ChannelTarget = 'node' | 'edge' | 'both';

export type ChannelDescriptor = {
  readonly label: string;
  readonly target: ChannelTarget;
};

export const CHANNEL_CATALOG = {
  color: { label: 'Color', target: 'both' },
  opacity: { label: 'Opacity', target: 'both' },
  size: { label: 'Size', target: 'node' },
  label: { label: 'Label', target: 'node' },
  'stroke.dash': { label: 'Stroke Dash', target: 'node' },
  'stroke.width': { label: 'Stroke Width', target: 'node' },
  z: { label: 'Z Index', target: 'node' },
  'flow.enable': { label: 'Flow Animation', target: 'edge' },
  'line-style': { label: 'Line Style', target: 'edge' },
  width: { label: 'Width', target: 'edge' },
  'edge-color': { label: 'Edge Color', target: 'edge' },
} as const satisfies Record<string, ChannelDescriptor>;

export const CHANNEL_IDS = CHANNELS;

/** Scale-map ids, mirrored by `compile.ts`'s runtime implementations. */
export type ScaleMapId =
  | 'truth-to-color'
  | 'priority-to-size'
  | 'confidence-to-opacity'
  | 'time-to-depth';

export const SCALE_MAP_CATALOG = {
  'truth-to-color': { label: 'Truth → Color (red→green)' },
  'priority-to-size': { label: 'Priority → Size' },
  'confidence-to-opacity': { label: 'Confidence → Opacity' },
  'time-to-depth': { label: 'Time → Depth' },
} as const satisfies Record<ScaleMapId, { label: string }>;

export const SCALE_MAP_IDS = Object.keys(SCALE_MAP_CATALOG) as ScaleMapId[];