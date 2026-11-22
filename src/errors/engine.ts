import { codedError } from './senars-error';

export const EngineError = codedError('EngineError', 'ENGINE_ERROR');
export type EngineError = InstanceType<typeof EngineError>;
