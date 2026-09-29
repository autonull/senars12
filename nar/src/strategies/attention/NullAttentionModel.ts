import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { AttentionContext, AttentionModel } from '../types.js';

/**
 * The absence of attention, not a registered strategy.
 *
 * `Memory` needs *an* `AttentionModel`, and a substrate default must not be a
 * strategy: the `attention` slot's value only ever comes from the registry, and
 * `SimpleAttention` is one. A bare `new Memory()` used to get a silent `0.3`
 * boost on every prime, which is a strategy choice made in a constructor
 * default. This model makes no choice — it primes nothing and leaves decay to
 * the caller's own rate — so a memory that was not given an attention model
 * behaves identically whether or not the caller remembered to pass one.
 */
export class NullAttentionModel implements AttentionModel {
  readonly metadata = {
    name: 'null',
    description: 'No priming and no extra decay; the substrate default',
  };

  prime(_concept: Concept, _context: AttentionContext): number {
    return 0;
  }

  /**
   * `decay` returns the *amount* to subtract, which `Memory.decayAll` then
   * deducts from the concept's priority. Zero means this model contributes no
   * decay of its own — not "decay by the whole priority", which is how an
   * earlier reading of this contract silently flattened every concept to zero.
   */
  decay(_concept: Concept, _cyclesElapsed: number, _baseDecayRate: number): number {
    return 0;
  }

  tick(_memory: MemoryView, _cycleCount: number): void {}
}
