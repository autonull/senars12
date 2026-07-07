import { describe, it, expect, beforeEach } from 'vitest';
import { MeTTaInterpreter } from '../src/engine/interpreter.js';
import { InMemorySpace } from '../src/core/space.js';
import { bootstrapStdLib, clearOps } from '../src/index.js';
import { parseMeTTa } from '../src/parser/runtime.js';
import { sym, num, expr } from '../src/index.js';
import { Effect } from 'effect';

beforeEach(() => {
  clearOps();
  bootstrapStdLib();
});

describe('MeTTaInterpreter', () => {
  it('evaluates simple arithmetic expression', async () => {
    const interpreter = new MeTTaInterpreter();
    const space = new InMemorySpace('default');
    interpreter.addSpace(space);
    
    const program = expr(sym('+'), num(2), num(3));
    const result = await Effect.runPromise(interpreter.evaluate(program));
    expect(result.kind).toBe(0);
    expect(result.value).toBe('5');
  });

  it('evaluates subtraction', async () => {
    const interpreter = new MeTTaInterpreter();
    const space = new InMemorySpace('default');
    interpreter.addSpace(space);
    
    const program = expr(sym('-'), num(10), num(4));
    const result = await Effect.runPromise(interpreter.evaluate(program));
    expect(result.value).toBe('6');
  });

  it('evaluates multiplication', async () => {
    const interpreter = new MeTTaInterpreter();
    const space = new InMemorySpace('default');
    interpreter.addSpace(space);
    
    const program = expr(sym('*'), num(6), num(7));
    const result = await Effect.runPromise(interpreter.evaluate(program));
    expect(result.value).toBe('42');
  });

  it('evaluates parsed expression', async () => {
    const interpreter = new MeTTaInterpreter();
    const space = new InMemorySpace('default');
    interpreter.addSpace(space);
    
    const program = parseMeTTa('(+ 1 2)');
    const result = await Effect.runPromise(interpreter.evaluate(program));
    expect(result.value).toBe('3');
  });
});