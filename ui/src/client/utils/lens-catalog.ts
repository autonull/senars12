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
 * The channel and scale-map catalogs are the input vocabulary `lens-designer`
 * generates its form from, so the designer never hand-lists options.
 */

import type { BuiltinLens } from '../../shared/lens-schema.js';
import {
  BUILTIN_LENS_IDS,
  builtinLensSpecs,
  LensSpecSchema,
  type LensSpec,
} from '../../shared/lens-schema.js';
import { LENS_COLORS_HEX, LENS_DESCRIPTIONS, LENS_LABELS } from '../../shared/constants.js';
import type { Channel } from '../modulation/types.js';
import { theme } from './theme.js';

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

export type LensDescriptor = {
  readonly id: BuiltinLens;
  readonly label: string;
  readonly description: string;
  readonly color: string;
  readonly defaultLayout: string;
  readonly primary: boolean;
  /** The full core spec (modulation + `requires`) this row presents. */
  readonly spec: LensSpec;
};

const SPEC_BY_ID = new Map<string, LensSpec>(builtinLensSpecs().map((spec) => [spec.id, spec]));

function specOf(id: BuiltinLens): LensSpec {
  const spec = SPEC_BY_ID.get(id);
  if (!spec) throw new Error(`built-in lens '${id}' has no lens spec`);
  return spec;
}

export const LENS_CATALOG = Object.fromEntries(
  BUILTIN_LENS_IDS.map((id) => [
    id,
    {
      id,
      label: LENS_LABELS[id] ?? id,
      description: LENS_DESCRIPTIONS[id] ?? '',
      color: LENS_COLORS_HEX[id] ?? theme.colors.accentCyan,
      defaultLayout: LENS_DEFAULT_LAYOUTS[id],
      primary: LENS_PRIMARY[id],
      spec: specOf(id),
    } satisfies LensDescriptor,
  ])
) as Record<BuiltinLens, LensDescriptor>;

export const LENS_IDS: BuiltinLens[] = [...BUILTIN_LENS_IDS];

export const PRIMARY_LENSES: LensDescriptor[] = LENS_IDS.filter(
  (id) => LENS_PRIMARY[id]
).map((id) => LENS_CATALOG[id]);

export const lensMeta = (id: string): LensDescriptor | undefined =>
  (LENS_CATALOG as Record<string, LensDescriptor>)[id];

export const builtinLensSpec = (id: string): LensSpec | undefined => lensMeta(id)?.spec;

/** The one validation path for a lens definition, shared by the designer and the store. */
export type LensValidation =
  | { readonly ok: true; readonly spec: LensSpec }
  | { readonly ok: false; readonly error: string };

export function validateLens(input: unknown): LensValidation {
  const parsed = LensSpecSchema.safeParse(input);
  if (parsed.success) return { ok: true, spec: parsed.data as LensSpec };
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