import { describe, expect, it } from 'vitest';
import { FenwickBag, PriorityBag, resolveBagSlot } from '@senars/nar/bag';
import { ConfigurationError } from '@senars/nar/types';
import {
  DEFAULT_COGNITIVE_PARAMETERS,
  validateParameters,
} from '@senars/nar/config/cognitive-parameters';
import { Memory } from '@senars/nar/memory';
import { atom, Truth } from '../../nar/src/terms/index.js';
import { createBudget } from '../../nar/src/types/index.js';

/**
 * TODO27 Bench 107 — the bag slot is a contract.
 *
 * Falsifies: "`strategies.bag.type` selects nothing" and "`strategies.bag.config`
 * is inert". Bags are built per concept, so the slot has no instance to resolve;
 * what it has is a validated name and two decay knobs that reach the bag.
 */

describe('Bench 107 — the bag slot validates and reaches the bag', () => {
  it('an unknown implementation is named with its candidates', () => {
    const errors = validateParameters({ strategies: { bag: { type: 'skip-list' } } as never });
    expect(errors.errors[0]).toMatch(/strategies\.bag\.type/);
    expect(errors.errors[0]).toMatch(/priority, fenwick/);
    expect(errors.valid).toBe(false);
  });

  it('an unrecognised config key is rejected by name', () => {
    const errors = validateParameters({
      strategies: { bag: { type: 'priority', config: { decay: 0.5 } } } as never,
    });
    expect(errors.errors[0]).toMatch(/strategies\.bag\.config.*decay/s);
  });

  it('a config value outside [0, 1] is rejected', () => {
    expect(
      validateParameters({ strategies: { bag: { type: 'priority', config: { decayRate: 4 } } } as never })
        .valid
    ).toBe(false);
  });

  it('the default parameters validate', () => {
    expect(validateParameters(DEFAULT_COGNITIVE_PARAMETERS).valid).toBe(true);
    expect(resolveBagSlot(undefined).implementation).toBe('priority');
  });

  it('the named implementation is the one the concepts are built from', () => {
    const memory = new Memory({ bag: resolveBagSlot({ type: 'fenwick' }) });
    memory.addConcept(atom('cat'));
    expect(memory.getConcept(atom('cat'))!.beliefBag).toBeInstanceOf(FenwickBag);

    const priority = new Memory({ bag: resolveBagSlot({ type: 'priority' }) });
    priority.addConcept(atom('cat'));
    expect(priority.getConcept(atom('cat'))!.beliefBag).toBeInstanceOf(PriorityBag);
  });

  it('the configured decay rate reaches the bag', () => {
    const memory = new Memory({ bag: resolveBagSlot({ type: 'priority', config: { decayRate: 0.5 } }) });
    const concept = memory.addConcept(atom('cat'));
    expect(concept.beliefBag.decayRateValue).toBe(0.5);

    const untouched = new Memory({ bag: resolveBagSlot({ type: 'priority' }) });
    expect(untouched.addConcept(atom('cat')).beliefBag.decayRateValue).toBe(0.01);
  });

  it('resolution refuses an unvalidated slot rather than falling back silently', () => {
    expect(() => resolveBagSlot({ type: 'skip-list' as never })).toThrow(ConfigurationError);
  });

  it('a belief survives a decay pass, so the bag still holds what it was given', () => {
    const memory = new Memory({ bag: resolveBagSlot({ type: 'fenwick' }) });
    const term = atom('cat');
    memory.addConcept(term).addTask('belief', { term, truth: Truth.create(0.9, 0.9), budget: createBudget(0.9) });
    expect(memory.getConcept(term)!.beliefBag.peek()!.truth!.f).toBe(0.9);
  });
});
