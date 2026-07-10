import { describe, expect, it } from 'vitest';
import { parseMeTTa } from '../src/parser/runtime.js';
import { AtomKind } from '../src/types/ast.js';

describe('MeTTa Parser', () => {
  it('parses symbols', () => {
    const result = parseMeTTa('cat');
    expect(result.kind).toBe(AtomKind.Symbol);
    expect((result as { value: string }).value).toBe('cat');
  });

  it('parses variables', () => {
    const result = parseMeTTa('$x');
    expect(result.kind).toBe(AtomKind.Variable);
    expect((result as { name: string }).name).toBe('$x');
  });

  it('parses expressions', () => {
    const result = parseMeTTa('(=> (cat $x) (animal $x))');
    expect(result.kind).toBe(AtomKind.Expression);
    const expr = result as { operator: { kind: number; value?: string }; args: unknown[] };
    expect(expr.operator.value).toBe('=>');
    expect(expr.args).toHaveLength(2);
    expect(expr.args[0]?.kind).toBe(AtomKind.Expression);
    expect(expr.args[1]?.kind).toBe(AtomKind.Expression);
  });

  it('parses nested expressions', () => {
    const result = parseMeTTa('(a (b c) d)');
    expect(result.kind).toBe(AtomKind.Expression);
    const expr = result as { operator: { kind: number; value?: string }; args: unknown[] };
    expect(expr.operator.value).toBe('a');
    expect(expr.args).toHaveLength(2);
    expect(expr.args[0]?.kind).toBe(AtomKind.Expression);
    expect(expr.args[1]?.kind).toBe(AtomKind.Symbol);
  });

  it('parses numbers', () => {
    const result = parseMeTTa('42');
    expect(result.kind).toBe(AtomKind.Number);
    expect((result as { value: number }).value).toBe(42);
  });
});
