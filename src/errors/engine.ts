import { codedError } from './senars-error.js';

export const EngineError = codedError('EngineError', 'ENGINE_ERROR');
export type EngineError = InstanceType<typeof EngineError>;
