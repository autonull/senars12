import {describe, it, expect} from '@jest/globals';
import { parse } from '../src/nar/terms/peggy-generated.js';
import { TermFactory } from '../src/nar/terms/factory.js';

describe('Input test', () => {
  it('should parse cat', () => {
    const result = parse('cat', { termFactory: TermFactory });
    console.log('cat result:', result);
    expect(result).toBeDefined();
  });

  it('should parse (cat-->animal)', () => {
    const result = parse('(cat-->animal)', { termFactory: TermFactory });
    console.log('(cat-->animal) result:', result);
    expect(result).toBeDefined();
  });
    
  it('should parse (cat-->animal).', () => {
    const result = parse('(cat-->animal).', { termFactory: TermFactory });
    console.log('(cat-->animal). result:', result);
    expect(result).toBeDefined();
  });
});
