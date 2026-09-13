import { describe, expect, it } from 'vitest';
import { EGraph, type RewriteRule } from '../src/engine/egraph.js';
import { expr, num, sym } from '../src/index.js';

describe('EGraph', () => {
  it('adds atoms and returns id', () => {
    const egraph = new EGraph();
    const id = egraph.add(sym('a'));
    expect(id).toBe(0);
  });

  it('returns same id for identical atoms', () => {
    const egraph = new EGraph();
    const id1 = egraph.add(sym('a'));
    const id2 = egraph.add(sym('a'));
    expect(id1).toBe(id2);
  });

  it('returns different id for different atoms', () => {
    const egraph = new EGraph();
    const id1 = egraph.add(sym('a'));
    const id2 = egraph.add(sym('b'));
    expect(id1).not.toBe(id2);
  });

  it('saturates with rewrite rules', () => {
    const egraph = new EGraph();
    const id = egraph.add(expr(sym('add'), num(1), num(2)));

    const rule: RewriteRule = {
      name: 'to-expr',
      match: (atom) => (atom.kind === 2 ? expr(sym('val'), num(atom.value)) : null),
    };

    egraph.saturate([rule]);
    const extracted = egraph.extract(id, (_) => 0);
    expect(extracted.kind).toBe(4);
  });

  it('extracts atom with cost function', () => {
    const egraph = new EGraph();
    const id = egraph.add(sym('a'));
    const extracted = egraph.extract(id, (a) => (a.kind === 0 ? 1 : 0));
    expect(extracted.kind).toBe(0);
  });
});
