import {describe, it, expect} from '@jest/globals';
import { parse } from '../src/nar/terms/peggy-generated.js';
import { TermFactory } from '../src/nar/terms/factory.js';

describe('No period test', () => {
  it('should parse first without period', () => {
    const result1 = parse('(cat-->animal)', { termFactory: TermFactory });
    console.log('Result1:', result1);
    expect(result1).toBeDefined();
  });

  it('should parse second without period', () => {
    const result2 = parse('(animal-->"living being")', { termFactory: TermFactory });
    console.log('Result2:', result2);
    expect(result2).toBeDefined();
  });
});
