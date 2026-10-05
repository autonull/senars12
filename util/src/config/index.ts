/**
 * @senars/util/config — shared configuration types, validation, and env mapping.
 * @public
 */

export {
  type BoundRange,
  type BoundSpec,
  boundRange,
  boundSpec,
  type CognitiveBoundCategory,
  type CognitiveBoundKey,
  type CognitiveBounds,
  cognitiveBounds,
  getAllCognitiveBounds,
  getCognitiveBound,
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
  type BoundProp,
  getBound,
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
  systemOneBoundSpec,
  type SystemOneBoundCategory,
  type SystemOneBoundKey,
  systemOneBounds,
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
