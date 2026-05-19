import {describe, it, expect} from '@jest/globals';
import { parse } from '../src/nar/terms/peggy-generated.js';
import { TermFactory } from '../src/nar/terms/factory.js';

describe('Double parse', () => {
  it('should parse twice', () => {
    console.log('First parse...');
    const result1 = parse('(cat-->animal).', { termFactory: TermFactory });
    console.log('First result:', result1);
    
    console.log('Second parse...');
    const result2 = parse('(animal-->"living being").', { termFactory: TermFactory });
    console.log('Second result:', result2);
    
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });
});
