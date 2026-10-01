/**
 * The attention slot's owner surface.
 *
 * Declared here rather than left as two methods on `Memory` because a
 * reconfigure installs the model a parameter graph resolved, and the consumer
 * that does the installing (`CognitiveController`) should depend on the ability
 * rather than on the facade. A4 replaces the body with the attention owner's
 * `commit(now)`; the contract does not move (TODO29.a §5.4).
 */

import type { AttentionModel } from '../../strategies/types.js';

export interface AttentionOwner {
  readonly attentionModel: AttentionModel;
  setAttentionModel(model: AttentionModel): void;
}