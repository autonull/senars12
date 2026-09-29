/**
 * @senars/util/config — shared configuration types, validation, and env mapping.
 * @public
 */

export {
  type CognitiveBoundCategory,
  type CognitiveBoundKey,
  type CognitiveBounds,
  cognitiveBounds,
  getAllCognitiveBounds,
  getCognitiveBound,
} from './cognitive-bounds.js';
export { type DialogueConfig, dialogueDefaults, dialogueSchema } from './dialogue.js';
export {
  envBool,
  envCsv,
  envFirst,
  envInt,
  envNum,
  envNumOr,
  envPositive,
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
  getBound,
  type BoundProp,
  type NarCoreBoundKey,
  type NarCoreBounds,
  narCoreBounds,
  narCoreDefaultedNumber,
  narCoreNumber,
} from './nar-core-bounds.js';
export { CACHE_DIR, cachePath } from './paths.js';
export { type SystemOneConfig, systemOneDefaults, systemOneSchema } from './system-one.js';
export type {
  ConfigCapability,
  ConfigEvent,
  ConfigSchema,
  ConfigView,
} from './types.js';
export { type ValidatedAgentOptions } from './validation.js';
export {
  AgentOptionsValidationError,
  agentOptionsSchema,
  contextOptsSchema,
  parseOrThrow,
  SchemaValidationError,
  validateAgentOptions,
} from './validation.js';
