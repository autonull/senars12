import { describe, it, expect } from 'vitest';
import { parseMeTTa } from '../src/parser/runtime.js';

describe('MeTTa Parser', () => {
  it('parses symbols', () => {
    const result = parseMeTTa('cat');
    expect(result).toEqual({ type: 'symbol', value: 'cat' });
  });

  it('parses variables', () => {
    const result = parseMeTTa('$x');
    expect(result).toEqual({ type: 'variable', name: '$x' });
  });

  it('parses expressions', () => {
    const result = parseMeTTa('(=> (cat $x) (animal $x))');
    expect(result.type).toBe('expression');
    if (result.type === 'expression') {
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toEqual({ type: 'symbol', value: '=>' });
    }
  });

  it('parses nested expressions', () => {
    const result = parseMeTTa('(a (b c) d)');
    expect(result.type).toBe('expression');
    if (result.type === 'expression') {
      expect(result.items).toHaveLength(3);
    }
  });

  it('parses numbers', () => {
    const result = parseMeTTa('42');
    expect(result).toEqual({ type: 'number', value: 42 });
  });
});
