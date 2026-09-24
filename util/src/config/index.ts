/**
 * @senars/util/config — shared configuration types, validation, and env mapping.
 * @public
 */

export { parseEnvValue, readEnvOverrides, SENARS_ENV_MAP } from './env.js';
export { type LMSettingsShape, lmSettingsSchema, lmSettingsShape } from './lm-schema.js';
export { narCoreBounds, type NarCoreBounds, type NarCoreBoundKey, getBound } from './nar-core-bounds.js';
export { cognitiveBounds, type CognitiveBounds, type CognitiveBoundCategory, type CognitiveBoundKey, getCognitiveBound, getAllCognitiveBounds } from './cognitive-bounds.js';
export type {
  ConfigCapability,
  ConfigEvent,
  ConfigSchema,
  ConfigView,
} from './types.js';
export type { ValidatedAgentOptions } from './validation.js';
export {
  AgentOptionsValidationError,
  agentOptionsSchema,
  contextOptsSchema,
  validateAgentOptions,
} from './validation.js';
export { systemOneDefaults, systemOneSchema, type SystemOneConfig } from './system-one.js';
export { dialogueDefaults, dialogueSchema, type DialogueConfig } from './dialogue.js';
