import {describe, it, expect} from '@jest/globals';
import { parse } from '../src/nar/terms/peggy-generated.js';
import { TermFactory } from '../src/nar/terms/factory.js';

describe('String test', () => {
  it('should parse first', () => {
    const input1 = '(cat-->animal)';
    console.log('Input1:', JSON.stringify(input1), 'length:', input1.length);
    console.log('Input1 chars:', Array.from(input1).map(c => c.charCodeAt(0)));
    const result1 = parse(input1, { termFactory: TermFactory });
    expect(result1).toBeDefined();
  });

  it('should parse second', () => {
    const input2 = '(animal-->"living being")';
    console.log('Input2:', JSON.stringify(input2), 'length:', input2.length);
    console.log('Input2 chars:', Array.from(input2).map(c => c.charCodeAt(0)));
    const result2 = parse(input2, { termFactory: TermFactory });
    expect(result2).toBeDefined();
  });
});
