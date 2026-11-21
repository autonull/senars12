/**
 * The logic command surface: prove, model, counterexample, check, convert.
 *
 * The proof is re-checkable without the prover; the verifier is the second
 * witness. A tampered certificate is refused rather than accepted.
 */

import { describe, expect, it } from 'vitest';
import { atom } from '../../src/logics/axiomatic/ast.js';
import { check, convert, counterexample, model, prove } from '../../src/logic/commands.js';
import { parseAtom, parseClause, parseProgram } from '../../src/logic/parse.js';
import { termInterner } from '../../src/kernel/terms/intern.js';

const PROGRAM = [
  'parent(john, mary)',
  'parent(mary, ann)',
  'ancestor(X, Y) :- parent(X, Y)',
  'ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y)',
].join('. ');

describe('logic commands', () => {
  it('parses facts, rules and variables', () => {
    expect(parseAtom('parent(john, X)').args.map((arg) => arg.op)).toEqual(['const', 'var']);
    expect(parseClause('ancestor(X, Y) :- parent(X, Y)').literals).toHaveLength(2);
    expect(parseProgram('a. b.')).toHaveLength(2);
  });

  it('proves a goal and returns a re-checkable certificate', () => {
    const result = prove(PROGRAM, 'ancestor(john, ann)');
    expect(result.ok).toBe(true);
    expect(result.verdict?.status).toBe('proved');
    if (result.verdict?.status !== 'proved') return;

    const certificate = JSON.stringify(result.verdict.certificate);
    expect(check(certificate).verdict?.status).toBe('proved');
  });

  it('refuses a tampered certificate', () => {
    const result = prove(PROGRAM, 'ancestor(john, ann)');
    if (result.verdict?.status !== 'proved') throw new Error('expected a proof');

    const certificate = result.verdict.certificate;
    const tampered = JSON.stringify({
      ...certificate,
      theorem: { predicate: 'ancestor', args: [termInterner.constant('john'), termInterner.constant('mary')], negated: false },
    });
    expect(check(tampered).verdict?.status).toBe('unknown');
  });

  it('reports unknown when the goal does not follow', () => {
    const result = prove(PROGRAM, 'ancestor(john, bob)');
    expect(result.ok).toBe(false);
    expect(result.verdict?.status).toBe('unknown');
  });

  it('finds a model and a countermodel', () => {
    const satisfiable = model(atom('P', []));
    expect(satisfiable.ok).toBe(true);

    const counter = counterexample(atom('P', []));
    expect(counter.ok).toBe(true);
    expect(counter.verdict?.status).toBe('refuted');
  });

  it('round-trips narsese through json', () => {
    const json = convert('cat --> animal', 'json');
    expect(json.ok).toBe(true);
    const narsese = convert(json.output ?? '', 'narsese');
    expect(narsese.ok).toBe(true);
    expect(narsese.output).toBe('cat --> animal');
  });

  it('renders prolog and tptp atoms', () => {
    expect(convert('parent(john, X)', 'prolog').output).toBe('parent(john, X)');
    expect(convert('parent(john, X)', 'tptp').output).toBe('fof(1, axiom, parent(john,X)).');
  });
});
