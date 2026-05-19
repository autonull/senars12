import {describe, it, expect} from '@jest/globals';
import { parse } from '../src/nar/terms/peggy-generated.js';
import { TermFactory } from '../src/nar/terms/factory.js';

describe('Options test', () => {
  it('should parse first', () => {
    const options1 = { termFactory: TermFactory };
    console.log('Options1 before:', JSON.stringify(options1));
    const result1 = parse('(cat-->animal).', options1);
    console.log('Options1 after:', JSON.stringify(options1));
    console.log('Result1:', result1);
    expect(result1).toBeDefined();
  });

  it('should parse second', () => {
    const options2 = { termFactory: TermFactory };
    console.log('Options2 before:', JSON.stringify(options2));
    const result2 = parse('(animal-->"living being").', options2);
    console.log('Options2 after:', JSON.stringify(options2));
    console.log('Result2:', result2);
    expect(result2).toBeDefined();
  });
});
