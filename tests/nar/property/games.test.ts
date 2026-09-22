import fc from 'fast-check';
import { createArcadeRegistry } from '../../../nar/src/game';

describe('Game spec contract (property)', () => {
  const registry = createArcadeRegistry();

  it('every registered game exposes non-empty legalActions on a fresh state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...registry.names()),
        fc.integer({ min: 0, max: 1000 }),
        (name, seed) => {
          const spec = registry.get(name);
          expect(spec).toBeDefined();
          const game = spec!.create(seed);
          const actions = game.legalActions(game.state());
          expect(Array.isArray(actions)).toBe(true);
          expect(actions.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stepping a legal action returns a well-formed outcome', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...registry.names()),
        fc.integer({ min: 0, max: 1000 }),
        (name, seed) => {
          const spec = registry.get(name);
          expect(spec).toBeDefined();
          const game = spec!.create(seed);
          const state = game.state();
          const [action] = game.legalActions(state);
          expect(action).toBeDefined();
          const outcome = game.step(action as never);
          expect(typeof outcome.reward).toBe('number');
          expect(typeof outcome.terminal).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});
