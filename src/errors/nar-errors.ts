import { codedError } from './senars-error.js';

export const ValidationError = codedError('ValidationError', 'VALIDATION_ERROR');
export type ValidationError = InstanceType<typeof ValidationError>;

export const ConfigurationError = codedError('ConfigurationError', 'CONFIGURATION_ERROR');
export type ConfigurationError = InstanceType<typeof ConfigurationError>;

export const OperationError = codedError('OperationError', 'OPERATION_ERROR');
export type OperationError = InstanceType<typeof OperationError>;
