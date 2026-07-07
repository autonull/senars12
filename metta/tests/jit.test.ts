import { describe, it, expect } from 'vitest';
import { JITCompiler } from '../src/performance/jit.js';
import { num, sym, expr } from '../src/index.js';

describe('JITCompiler', () => {
  it('records pattern usage', () => {
    const jit = new JITCompiler(5);
    const pattern = expr(sym('+'), num(1), num(2));
    
    jit.record(pattern);
    expect(jit.isHot(pattern)).toBe(false);
    
    for (let i = 0; i < 5; i++) {
      jit.record(pattern);
    }
    expect(jit.isHot(pattern)).toBe(true);
  });

  it('compiles hot patterns', () => {
    const jit = new JITCompiler(1);
    const pattern = expr(sym('+'), num(1), num(2));
    
    const impl = () => num(3);
    jit.compile(pattern, impl);
    
    expect(jit.getCompiled(pattern)).toBe(impl);
  });

  it('returns stats', () => {
    const jit = new JITCompiler();
    const stats = jit.getStats();
    expect(stats.hotPatterns).toBe(0);
    expect(stats.compiled).toBe(0);
  });

  it('clears state', () => {
    const jit = new JITCompiler();
    const pattern = expr(sym('+'), num(1), num(2));
    jit.record(pattern);
    jit.compile(pattern, () => num(3));
    
    jit.clear();
    expect(jit.getStats().hotPatterns).toBe(0);
    expect(jit.getStats().compiled).toBe(0);
  });
});