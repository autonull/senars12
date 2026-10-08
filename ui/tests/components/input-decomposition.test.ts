import { describe, expect, it } from 'vitest';
import {
  decomposeInput,
  isFaithfulDecomposition,
} from '../../src/client/core/input-decomposition.js';

describe('decomposeInput', () => {
  it('returns nothing for blank input', () => {
    expect(decomposeInput('   ')).toEqual([]);
  });

  it('splits a mixed input into ordered claim/question segments', () => {
    expect(decomposeInput('Robins are birds. Birds are animals. What is a robin?')).toEqual([
      { kind: 'claim', text: 'Robins are birds.' },
      { kind: 'claim', text: 'Birds are animals.' },
      { kind: 'question', text: 'What is a robin?' },
    ]);
  });

  it('classifies an interrogative without a question mark as a question', () => {
    expect(decomposeInput('Why do birds migrate')).toEqual([
      { kind: 'question', text: 'Why do birds migrate' },
    ]);
  });

  it('treats a slash line as a single command', () => {
    expect(decomposeInput('/config reasoning true')).toEqual([
      { kind: 'command', text: '/config reasoning true' },
    ]);
  });
});

describe('isFaithfulDecomposition', () => {
  it('is true only for a single verbatim claim', () => {
    expect(isFaithfulDecomposition('hello', decomposeInput('hello'))).toBe(true);
    expect(isFaithfulDecomposition('a. b', decomposeInput('a. b'))).toBe(false);
  });
});
