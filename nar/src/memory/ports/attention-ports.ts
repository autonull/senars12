/**
 * The one memory port that names the strategy layer.
 *
 * `AttentionOwner` is a slot a parameter graph fills with an
 * `AttentionModel`, so it is the only contract here whose vocabulary belongs to
 * `strategies/`. It is its own module for the same reason `MemoryView` sits
 * below the port barrel: keeping the `memory → strategies` edge in one file
 * means the read surface can depend on memory's own contracts
 * (`memory-ports.ts`) without dragging the strategy layer back into itself.
 */

import type { AttentionModel } from '../../strategies/types.js';

/** The attention slot's owner surface.
 *
 * Declared here rather than left as two methods on `Memory` because a
 * reconfigure installs the model a parameter graph resolved, and the consumer
 * that does the installing (`CognitiveController`) should depend on the ability
 * rather than on the facade. A4 replaces the body with the attention owner's
 * `commit(now)`; the contract does not move (TODO29.a §5.4).
 */
export interface AttentionOwner {
  readonly attentionModel: AttentionModel;
  setAttentionModel(model: AttentionModel): void;
}