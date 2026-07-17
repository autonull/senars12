/**
 * @senars/util/config — shared configuration types, validation, and env mapping.
 * @public
 */
export type {
  ConfigSchema,
  ConfigEvent,
  ConfigCapability,
  ConfigView,
} from './types.js';
export {
  contextOptsSchema,
  agentOptionsSchema,
  validateAgentOptions,
  AgentOptionsValidationError,
} from './validation.js';
export type { ValidatedAgentOptions } from './validation.js';
export { SENARS_ENV_MAP, parseEnvValue, readEnvOverrides } from './env.js';
