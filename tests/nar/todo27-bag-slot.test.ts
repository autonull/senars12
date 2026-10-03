import { PriorityBag, resolveBagSlot } from '@senars/nar/bag';
import {
  DEFAULT_COGNITIVE_PARAMETERS,
  validateParameters,
} from '@senars/nar/config/cognitive-parameters';
import { Memory } from '@senars/nar/memory';
import { ConfigurationError } from '@senars/nar/types';
import { describe, expect, it } from 'vitest';
import { atom, Truth } from '../../nar/src/terms/index.js';
import { createTaskWeight } from '../../nar/src/types/index.js';

/**
 * TODO27 Bench 107 — the bag slot is a contract.
 *
 * Falsifies: "`strategies.bag.config` is inert". Bags are built per concept, so
 * the slot has no instance to resolve; what it has is two validated decay knobs
 * that reach the bag, and no `type` — `PriorityBag` is the only AIKR queue, so a
 * name for the choice would be a knob that cannot turn anything.
 */

describe('Bench 107 — the bag slot validates and reaches the bag', () => {
  it('an unrecognised config key is rejected by name', () => {
    const errors = validateParameters({
      strategies: { bag: { config: { decay: 0.5 } } } as never,
    });
    expect(errors.errors[0]).toMatch(/strategies\.bag\.config.*decay/s);
  });

  it('a config value outside [0, 1] is rejected', () => {
    expect(
      validateParameters({ strategies: { bag: { config: { decayRate: 4 } } } as never }).valid
    ).toBe(false);
  });

  it('the default parameters validate', () => {
    expect(validateParameters(DEFAULT_COGNITIVE_PARAMETERS).valid).toBe(true);
  });

  it('every concept bag is the one implementation', () => {
    const memory = new Memory({ bag: resolveBagSlot(undefined) });
    memory.addConcept(atom('cat'));
    expect(memory.getConcept(atom('cat'))!.beliefBag).toBeInstanceOf(PriorityBag);
  });

  it('the configured decay rate reaches the bag', () => {
    const memory = new Memory({ bag: resolveBagSlot({ config: { decayRate: 0.5 } }) });
    const concept = memory.addConcept(atom('cat'));
    expect(concept.beliefBag.decayRateValue).toBe(0.5);

    const untouched = new Memory({ bag: resolveBagSlot(undefined) });
    expect(untouched.addConcept(atom('cat')).beliefBag.decayRateValue).toBe(0.01);
  });

  it('resolution refuses an unvalidated slot rather than falling back silently', () => {
    expect(() => resolveBagSlot({ config: { decayRate: 4 } })).toThrow(ConfigurationError);
  });

  it('a belief survives a decay pass, so the bag still holds what it was given', () => {
    const memory = new Memory({ bag: resolveBagSlot(undefined) });
    const term = atom('cat');
    memory
      .addConcept(term)
      .addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createTaskWeight(0.9) });
    expect(memory.getConcept(term)!.beliefBag.peek()!.truth!.f).toBe(0.9);
  });
});
