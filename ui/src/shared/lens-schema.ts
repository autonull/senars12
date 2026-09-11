/**
 * Re-exported from @senars/core — single source of truth for lens schemas.
 * (The local copy previously drifted; see core/src/lens-schema.ts.)
 */

export type { BuiltinLens, LensSpec, ModulationSpec } from '@senars/core/lens-schema';
export {
  BUILTIN_LENS_IDS,
  builtinLensSpecs,
  isBuiltinLens,
  LensSpecSchema,
  lensSpecToJsonSchema,
  ModulationSchema,
} from '@senars/core/lens-schema';
