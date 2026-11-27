import { codedError } from './senars-error';
export const ValidationError = codedError('ValidationError', 'VALIDATION_ERROR');
export const ConfigurationError = codedError('ConfigurationError', 'CONFIGURATION_ERROR');
export const OperationError = codedError('OperationError', 'OPERATION_ERROR');
