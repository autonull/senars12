/**
 * @senars/util/config — shared configuration types, validation, and env mapping.
 * @public
 */

export { parseEnvValue, readEnvOverrides, SENARS_ENV_MAP } from './env.js';
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
