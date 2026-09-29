// The inference loop lives in `InferenceController`; `Reasoner` and the premise
// singletons it carried are gone (TODO27 §14). Strategies are reached through the
// registry, never imported.
export { createStrategy } from './strategies/base';
export type { Strategy } from '../strategies/types';
