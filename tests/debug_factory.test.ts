import {describe, it, expect} from '@jest/globals';
import { TermFactory } from '../src/nar/terms/factory.js';
import { parse } from '../src/nar/terms/peggy-generated.js';

describe('Factory test', () => {
  it('should parse first time', () => {
    console.log('Factory size before 1st:', TermFactory.size);
    const result1 = parse('(cat-->animal).', { termFactory: TermFactory });
    console.log('Factory size after 1st:', TermFactory.size);
    expect(result1).toBeDefined();
  });

  it('should parse second time', () => {
    console.log('Factory size before 2nd:', TermFactory.size);
    const result2 = parse('(animal-->"living being").', { termFactory: TermFactory });
    console.log('Factory size after 2nd:', TermFactory.size);
    expect(result2).toBeDefined();
  });
});
