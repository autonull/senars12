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
 */

import type { BuiltinLens, LensSpec } from '../../shared/lens-schema.js';
import { BUILTIN_LENS_IDS, builtinLensSpecs, LensSpecSchema, type LensSpec as LensSpecType } from '../../shared/lens-schema.js';
import { LENS_COLORS_HEX, LENS_DESCRIPTIONS, LENS_LABELS } from '../../shared/constants.js';
import type { Channel } from '../modulation/types.js';
import { theme } from './theme.js';
import { defineCatalog } from '../framework/catalog.js';

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

export const LENS_DEFS = defineCatalog({
  belief: {
    label: 'Belief',
    id: 'belief',
    description: LENS_DESCRIPTIONS.belief ?? 'Degree of belief in a statement.',
    color: LENS_COLORS_HEX.belief ?? theme.colors.accentCyan,
    defaultLayout: LENS_DEFAULT_LAYOUTS.belief,
    primary: LENS_PRIMARY.belief,
    spec: specOf('belief'),
  },
  goal: {
    label: 'Goal',
    id: 'goal',
    description: LENS_DESCRIPTIONS.goal ?? 'Active goals and their satisfaction.',
    color: LENS_COLORS_HEX.goal ?? theme.colors.accentCyan,
    defaultLayout: LENS_DEFAULT_LAYOUTS.goal,
    primary: LENS_PRIMARY.goal,
    spec: specOf('goal'),
  },
  contradiction: {
    label: 'Contradiction',
    id: 'contradiction',
    description: LENS_DESCRIPTIONS.contradiction ?? 'Contradictions detected in the workspace.',
    color: LENS_COLORS_HEX.contradiction ?? theme.colors.accentCyan,
    defaultLayout: LENS_DEFAULT_LAYOUTS.contradiction,
    primary: LENS_PRIMARY.contradiction,
    spec: specOf('contradiction'),
  },
  temporal: {
    label: 'Temporal',
    id: 'temporal',
    description: LENS_DESCRIPTIONS.temporal ?? 'Temporal ordering of events.',
    color: LENS_COLORS_HEX.temporal ?? theme.colors.accentCyan,
    defaultLayout: LENS_DEFAULT_LAYOUTS.temporal,
    primary: LENS_PRIMARY.temporal,
    spec: specOf('temporal'),
  },
} as const);

/** The semantic id of a lens — the catalog keys are its source (D3). */
export type LensId = keyof typeof LENS_DEFS.definition;

/** Every lens id, in catalog order. */
export const LENS_IDS = LENS_DEFS.ids;

export type LensEntry = typeof LENS_DEFS.definition[LensId];

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
} as const satisfies Record<Channel, ChannelDescriptor>;

export const CHANNEL_IDS = Object.keys(CHANNEL_CATALOG) as Channel[];

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