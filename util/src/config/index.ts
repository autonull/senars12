/**
 * @senars/util/config — shared configuration types, validation, and env mapping.
 * @public
 */

export {
  type BoundProp,
  type BoundProjection,
  type BoundRange,
  type BoundRow,
  type BoundSchemaOptions,
  type BoundSpec,
  type BoundTable,
  type FlatBoundProjection,
  type FlatBoundTable,
  flatBounds,
  type NestedBoundPath,
  type NestedBoundTable,
  nestedBounds,
  validateAgainstBounds,
} from './bounds.js';
export {
  type CognitiveBoundCategory,
  cognitiveBound,
  type CognitiveBounds,
  cognitiveBounds,
} from './cognitive-bounds.js';
export { type DialogueConfig, dialogueDefaults, dialogueSchema } from './dialogue.js';
export {
  type EnvKey,
  envBool,
  envCsv,
  envFirst,
  envInt,
  envNum,
  envNumOr,
  envPositive,
  envSet,
  envStr,
  envStrOr,
  isBooleanSpelling,
  isFalsy,
  isTruthy,
  parseEnvValue,
  readEnvOverrides,
  SENARS_ENV_MAP,
} from './env.js';
export { type LMSettingsShape, lmSettingsSchema, lmSettingsShape } from './lm-schema.js';
export {
  type NarCoreBoundKey,
  type NarCoreBounds,
  narCoreBounds,
  narCoreDefaultedNumber,
  narCoreDefaults,
  narCoreDefaultsSchema,
  narCoreNumber,
} from './nar-core-bounds.js';
export { CACHE_DIR, cachePath } from './paths.js';
export { signedUnitInterval, unitInterval } from './scalars.js';
export {
  CRITICALITY_LEVELS,
  criticalitySchema,
  type CriticalityLevel,
  systemOneBound,
  type SystemOneBoundCategory,
  type SystemOneBoundKey,
  systemOneBounds,
  type SystemOneBounds,
  type SystemOneConfig,
  systemOneDefaults,
  systemOneSchema,
} from './system-one.js';
export type {
  ConfigCapability,
  ConfigEvent,
  ConfigSchema,
  ConfigView,
} from './types.js';
export {
  agentOptionsSchema,
  contextOptsSchema,
  parseOrThrow,
  SchemaValidationError,
  type ValidatedAgentOptions,
} from './validation.js';
