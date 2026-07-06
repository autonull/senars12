import { describe, it, expect } from 'vitest';
import { ReductionPipeline } from '../src/engine/reduce.js';
import { registerOp, defineOp } from '../src/core/ops.js';
import { sym, num, expr, varr } from '../src/types/ast.js';

describe('ReductionPipeline', () => {
  it('reduces symbols to themselves', () => {
    const pipeline = new ReductionPipeline();
    const result = pipeline.reduce(sym('hello'));
    expect(result).toEqual(sym('hello'));
  });

  it('reduces numbers to themselves', () => {
    const pipeline = new ReductionPipeline();
    const result = pipeline.reduce(num(42));
    expect(result).toEqual(num(42));
  });

  it('applies substitution to variables', () => {
    const pipeline = new ReductionPipeline();
    const subst = new Map([['$x', sym('hello')]]);
    const result = pipeline.reduce(varr('$x'), subst);
    expect(result).toEqual(sym('hello'));
  });

  it('reduces expressions without registered ops', () => {
    const pipeline = new ReductionPipeline();
    const result = pipeline.reduce(expr(sym('+'), num(1), num(2)));
    expect(result.kind).toBe(4);
    expect((result as { operator: { value: string } }).operator.value).toBe('+');
  });

  it('executes registered operations', () => {
    registerOp('double', defineOp('double', (n: ReturnType<typeof num>) => num(n.value * 2)));
    
    const pipeline = new ReductionPipeline();
    const result = pipeline.reduce(expr(sym('double'), num(5)));
    expect(result.kind).toBe(2);
    expect((result as { value: number }).value).toBe(10);
  });
});