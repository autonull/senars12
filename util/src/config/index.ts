/**
 * @senars/util/config — shared configuration types, validation, and env mapping.
 * @public
 */

export {
  intAtLeast,
  intBetween,
  nonEmpty,
  nonNegativeInt,
  positiveInt,
  signedUnitInterval,
  timestamp,
  unitInterval,
  uuid,
} from './boundary.js';
export {
  type BoundProjection,
  type BoundProp,
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
  type CognitiveBounds,
  cognitiveBound,
  cognitiveBounds,
} from './cognitive-bounds.js';
export { withDefaults } from './defaults.js';
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
export {
  CRITICALITY_LEVELS,
  type CriticalityLevel,
  criticalitySchema,
  type SystemOneBoundCategory,
  type SystemOneBoundKey,
  type SystemOneBounds,
  type SystemOneConfig,
  systemOneBound,
  systemOneBounds,
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
