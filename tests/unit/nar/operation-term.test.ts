import { describe, expect, it } from 'vitest';
import {
  type OperationCall,
  operationTerm,
  readOperationTerm,
} from '../../../nar/src/terms/impls/operation-term.js';
import { isCompound, TermBuilder } from '../../../nar/src/terms/index.js';

describe('operation-term convention', () => {
  it('round-trips a named argument record', () => {
    expect(readOperationTerm(operationTerm('move', { dir: 'left', steps: 3 }))).toEqual({
      name: 'move',
      args: { dir: 'left', steps: 3 },
    });
  });

  it('decodes a value to the primitive it was written from', () => {
    const { args } = readOperationTerm(
      operationTerm('t', { int: 7, yes: true, no: false, quoted: '"hi"', bare: 'text' })
    ) as OperationCall;

    expect(args).toEqual({ int: 7, yes: true, no: false, quoted: 'hi', bare: 'text' });
  });

  it('an argument-less operation reads as no arguments, not as one named true', () => {
    expect(readOperationTerm(operationTerm('wait'))).toEqual({ name: 'wait', args: {} });
  });

  it('one argument needs no product wrapper', () => {
    const term = operationTerm('peek', { n: 1 });

    expect(term.kind).toBe('inheritance');
    expect(isCompound(term) && term.args[0]?.kind).toBe('inheritance');
  });

  it('reads a bare ^name atom, so an arm selector term reads as itself', () => {
    expect(readOperationTerm(TermBuilder.atom('^snake'))).toEqual({ name: 'snake', args: {} });
  });

  it('names no operation for a term that is not one', () => {
    expect(readOperationTerm(TermBuilder.atom('plain'))).toBeUndefined();
  });

  it('every encoder produces a term the decoder reads back identically', () => {
    const args = { alpha: 'one', beta: 2 };

    for (const name of ['move', 'switch_strategy', 'register_rule']) {
      expect(readOperationTerm(operationTerm(name, args))).toEqual({ name, args });
    }
  });
});
