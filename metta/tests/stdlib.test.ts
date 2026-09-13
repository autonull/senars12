import { beforeEach, describe, expect, it } from 'vitest';
import { bootstrapStdLib, clearOps, getOp, num, sym } from '../src/index.js';

beforeEach(() => {
  clearOps();
  bootstrapStdLib();
});

describe('Standard Library', () => {
  it('registers + operation', () => {
    expect(getOp('+')).toBeDefined();
    expect(getOp('+')?.pure).toBe(true);
  });

  it('registers - operation', () => {
    expect(getOp('-')).toBeDefined();
    expect(getOp('-')?.pure).toBe(true);
  });

  it('registers * operation', () => {
    expect(getOp('*')).toBeDefined();
    expect(getOp('*')?.pure).toBe(true);
  });

  it('registers = operation', () => {
    expect(getOp('=')).toBeDefined();
  });

  it('executes + on numbers', () => {
    const op = getOp('+');
    const result = op?.execute(num(2), num(3));
    expect(result?.value).toBe('5');
  });

  it('executes - on numbers', () => {
    const op = getOp('-');
    const result = op?.execute(num(5), num(2));
    expect(result?.value).toBe('3');
  });

  it('executes * on numbers', () => {
    const op = getOp('*');
    const result = op?.execute(num(4), num(3));
    expect(result?.value).toBe('12');
  });

  it('executes = on equal values', () => {
    const op = getOp('=');
    const result = op?.execute(sym('a'), sym('a'));
    expect(result?.value).toBe('True');
  });

  it('executes = on unequal values', () => {
    const op = getOp('=');
    const result = op?.execute(sym('a'), sym('b'));
    expect(result?.value).toBe('False');
  });

  it('executes cons operation', () => {
    const op = getOp('cons');
    const result = op?.execute(sym('head'), sym('tail'));
    expect(result?.kind).toBe(4);
    expect(result?.operator.value).toBe('cons');
  });
});
