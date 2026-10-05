import { codedError } from './senars-error.js';

export const ConfigError = codedError('ConfigError', 'CONFIG_ERROR');
export type ConfigError = InstanceType<typeof ConfigError>;
