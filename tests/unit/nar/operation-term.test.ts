import { describe, expect, it } from 'vitest';
import {
  type OperationCall,
  operationNameOf,
  operationTerm,
  readOperationTerm,
} from '../../../nar/src/terms/impls/operation-term.js';
import { termParser } from '../../../nar/src/terms/impls/parser-peggy.js';
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

  it('several arguments are a product, which is what makes them several', () => {
    const term = operationTerm('move', { dir: 'left', steps: 3 });

    expect(term.kind).toBe('operation');
    expect(isCompound(term) && term.args[1]?.kind).toBe('product');
    expect(isCompound(term) && term.args[1]?.args?.length).toBe(2);
  });

  it('names no operation for a term that is not one', () => {
    expect(readOperationTerm(TermBuilder.atom('plain'))).toBeUndefined();
    expect(
      operationNameOf(TermBuilder.inheritance(TermBuilder.atom('a'), TermBuilder.atom('b'))!)
    ).toBeUndefined();
  });

  it('an operation reads back from the text the serialiser writes', () => {
    const term = operationTerm('move', { dir: 'left', steps: 3 });

    expect(readOperationTerm(termParser.parse(term.toString()))).toEqual(readOperationTerm(term));
  });

  it('the sigil form is not a spelling of anything', () => {
    expect(() => termParser.parse('^move(dir-->left)')).toThrow();
    expect(() => termParser.parse('^move')).toThrow();
  });

  it('every encoder produces a term the decoder reads back identically', () => {
    const args = { alpha: 'one', beta: 2 };

    for (const name of ['move', 'switch_strategy', 'register_rule']) {
      expect(readOperationTerm(operationTerm(name, args))).toEqual({ name, args });
    }
  });
});
