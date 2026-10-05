import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createNAR, Truth, termKey, termParser, TermBuilder } from '../../../nar/src';
import { canonicalTerm, TERM_REDUCERS } from '../../../nar/src/terms';
import { createSeNARSRegistry } from '../../../nar/src/lm';
import { createLMService } from '../../../nar/src/lm/lm-service';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const testStateDir = join(process.cwd(), '.cache', 'test-derivation-quality');

describe('M9: Derivation Quality — Zero contradictory/redundant terms', () => {
  beforeEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
    await mkdir(testStateDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
  });

  test('hello-world scenario produces no contradictory/redundant terms', async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    const nar = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: false,
      maxConcepts: 1000,
      systemOne: { enabled: false },
    });

    await nar.start();

    // Hello-world scenario
    await nar.believe('(robin --> bird).', Truth.create(0.9, 0.9));
    await nar.believe('(bird --> animal).', Truth.create(0.9, 0.9));
    await nar.believe('(tweety --> robin).', Truth.create(0.9, 0.9));

    // Run inference cycles
    await nar.run(20);

    // Get all beliefs
    const beliefs = nar.getBeliefs();
    const beliefTerms = beliefs.map((b) => b.term);

    // Print all beliefs for debugging
    console.log('\n=== All Beliefs ===');
    for (const belief of beliefs) {
      console.log(
        `  ${belief.term} f=${belief.truth.f.toFixed(2)};c=${belief.truth.c.toFixed(2)}%`
      );
    }

    // Check for contradictory conjunctions (X & --X) - should be reduced to FALSE
    const contradictoryConjunctions = beliefTerms.filter((term) => {
      if (term.kind !== 'conjunction') return false;
      const args = term.args;
      for (const arg of args) {
        if (arg.kind === 'negation') {
          const negated = arg.args[0];
          if (
            args.some(
              (a) => a === negated || (a.kind === 'atom' && a.symbol === (negated as any).symbol)
            )
          ) {
            return true;
          }
        }
      }
      return false;
    });

    console.log('\n=== Contradictory Conjunctions (X & --X) ===');
    for (const term of contradictoryConjunctions) {
      console.log(`  ${term}`);
    }
    expect(contradictoryConjunctions).toHaveLength(0);

    // Check for redundant nesting (A & (A & B)) - should be flattened to (A & B)
    const redundantNesting = beliefTerms.filter((term) => {
      if (term.kind !== 'conjunction') return false;
      const args = term.args;
      for (const arg of args) {
        if (arg.kind === 'conjunction') {
          // Check if any arg of the nested conjunction is also a direct arg
          const nestedArgs = arg.args;
          for (const nested of nestedArgs) {
            if (args.includes(nested)) {
              return true;
            }
          }
        }
      }
      return false;
    });

    console.log('\n=== Redundant Nesting (A & (A & B)) ===');
    for (const term of redundantNesting) {
      console.log(`  ${term}`);
    }
    expect(redundantNesting).toHaveLength(0);

    // Check for (A & /A) patterns - negation of same term in conjunction
    // Note: /A is not standard Narsese, but check for any conjunction with arg and its negation
    const selfNegatingConjunctions = beliefTerms.filter((term) => {
      if (term.kind !== 'conjunction') return false;
      const args = term.args;
      const argKeys = new Set(args.map((a) => termKey(a)));
      for (const arg of args) {
        if (arg.kind === 'negation' && arg.args[0]) {
          const negatedKey = termKey(arg.args[0]);
          if (argKeys.has(negatedKey)) {
            return true;
          }
        }
      }
      return false;
    });

    console.log('\n=== Self-Negating Conjunctions (A & --A) ===');
    for (const term of selfNegatingConjunctions) {
      console.log(`  ${term}`);
    }
    expect(selfNegatingConjunctions).toHaveLength(0);

    // Check for redundant forms like ((A & B) & /B) - conjunction containing conjunction that has negation of another arg
    const complexRedundant = beliefTerms.filter((term) => {
      if (term.kind !== 'conjunction') return false;
      const args = term.args;
      // Check for nested conjunction with negation of sibling
      for (const arg of args) {
        if (arg.kind === 'conjunction') {
          const nestedArgs = arg.args;
          for (const nested of nestedArgs) {
            if (nested.kind === 'negation' && nested.args[0]) {
              const negated = nested.args[0];
              // Check if negated is also a direct arg or in another nested conjunction
              const allArgs = [...args];
              for (const a of allArgs) {
                if (a.kind === 'conjunction' && a !== arg) {
                  if (a.args.includes(negated)) return true;
                }
              }
              if (args.includes(negated)) return true;
            }
          }
        }
      }
      return false;
    });

    console.log('\n=== Complex Redundant Forms ((A & B) & /B) ===');
    for (const term of complexRedundant) {
      console.log(`  ${term}`);
    }
    expect(complexRedundant).toHaveLength(0);

    await nar.stop();
    await nar.dispose();
  });

  test('term reducers reach fixed point for all canonical forms', () => {
    // Test that TERM_REDUCERS correctly reduce problematic terms
    const testCases = [
      // Nested conjunction - flatten
      { input: '(A & (B & C))', expected: '(&,A,B,C)' },
      // Nested disjunction - flatten
      { input: '(A | (B | C))', expected: '(|,A,B,C)' },
      // Double negation - --(--A) reduces to A
      { input: '(--(--A))', expected: 'A' },
      // Conjunction with TRUE
      { input: '(&,TRUE,A)', expected: 'A' },
      // Conjunction with FALSE
      { input: '(&,FALSE,A)', expected: 'FALSE' },
      // Disjunction with TRUE
      { input: '(|,TRUE,A)', expected: 'TRUE' },
      // Disjunction with FALSE
      { input: '(|,FALSE,A)', expected: 'A' },
    ];

    for (const { input, expected } of testCases) {
      const parsed = termParser.parse(input);
      const canonical = canonicalTerm(parsed);
      const expectedTerm = termParser.parse(expected);
      expect(termKey(canonical)).toBe(termKey(expectedTerm));
    }
  });

  test('canonicalTerm detects self-contradiction in conjunction', () => {
    // (& A, --A) should reduce to FALSE
    const contradiction = TermBuilder.conjunction(
      TermBuilder.atom('A'),
      TermBuilder.negation(TermBuilder.atom('A'))
    );
    const canonical = canonicalTerm(contradiction);
    // Should reduce to FALSE atom
    expect(canonical.kind).toBe('atom');
    expect((canonical as any).symbol).toBe('FALSE');
  });

  test('canonicalTerm detects self-contradiction in disjunction', () => {
    // (| A, --A) should reduce to TRUE
    const contradiction = TermBuilder.disjunction(
      TermBuilder.atom('A'),
      TermBuilder.negation(TermBuilder.atom('A'))
    );
    const canonical = canonicalTerm(contradiction);
    // Should reduce to TRUE atom
    expect(canonical.kind).toBe('atom');
    expect((canonical as any).symbol).toBe('TRUE');
  });

  test('terms:canonical gate passes for all derived terms', () => {
    // This test ensures all derived terms pass the canonical gate
    // The actual gate is `pnpm terms:canonical` which tests the reducer fixed point
    // We just verify the reducers work as expected

    // Test a variety of edge cases - use valid Narsese syntax
    const edgeCases = [
      '(A & (B & C))', // should flatten to (A & B & C)
      '(&,A,B,A)', // should dedupe to (&,A,B)
      '(|,A,B,A)', // should dedupe to (|,A,B)
      '--(--A)', // double negation, should reduce to A
      '(&,TRUE,A)', // should reduce to A
      '(&,FALSE,A)', // should reduce to FALSE
      '(|,TRUE,A)', // should reduce to TRUE
      '(|,FALSE,A)', // should reduce to A
    ];

    for (const input of edgeCases) {
      const parsed = termParser.parse(input);
      const canonical = canonicalTerm(parsed);

      // Verify it's actually canonical (no reducer applies)
      for (const reducer of TERM_REDUCERS) {
        expect(
          reducer.applies(canonical),
          `Reducer ${reducer.id} should not apply to canonical term ${canonical} from ${input}`
        ).toBe(false);
      }
    }
  });
});
