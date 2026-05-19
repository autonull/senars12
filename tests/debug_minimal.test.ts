import {describe, it, expect} from '@jest/globals';
import { parse } from '../src/nar/terms/peggy-generated.js';
import { TermFactory } from '../src/nar/terms/factory.js';

describe('Minimal parser', () => {
  it('should parse first', () => {
    const result1 = parse('cat', { termFactory: TermFactory });
    console.log('Result1:', result1);
    expect(result1).toBeDefined();
  });

  it('should parse second', () => {
    const result2 = parse('animal', { termFactory: TermFactory });
    console.log('Result2:', result2);
    expect(result2).toBeDefined();
  });
});
