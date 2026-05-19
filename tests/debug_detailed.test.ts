import {describe, it, expect} from '@jest/globals';
import { parse } from '../src/nar/terms/peggy-generated.js';
import { TermFactory } from '../src/nar/terms/factory.js';

describe('Detailed test', () => {
  let parseResult1: any;
  let parseResult2: any;
  
  it('should parse first', () => {
    console.log('=== FIRST PARSE ===');
    parseResult1 = parse('(cat-->animal).', { termFactory: TermFactory });
    console.log('Result 1:', JSON.stringify(parseResult1, null, 2));
    expect(parseResult1).toBeDefined();
  });

  it('should parse second', () => {
    console.log('=== SECOND PARSE ===');
    try {
      parseResult2 = parse('(animal-->"living being").', { termFactory: TermFactory });
      console.log('Result 2:', JSON.stringify(parseResult2, null, 2));
    } catch (e: any) {
      console.log('Error message:', e.message);
      console.log('Error expected:', (e as any).expected);
      throw e;
    }
    expect(parseResult2).toBeDefined();
  });
});
