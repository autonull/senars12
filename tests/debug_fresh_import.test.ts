import {describe, it, expect} from '@jest/globals';

describe('Fresh import', () => {
  it('should parse first time', async () => {
    const { parse } = await import('../src/nar/terms/peggy-generated.js');
    const { TermFactory } = await import('../src/nar/terms/factory.js');
    
    const result = parse('(cat-->animal).', { termFactory: TermFactory });
    expect(result).toBeDefined();
  });

  it('should parse second time', async () => {
    const { parse } = await import('../src/nar/terms/peggy-generated.js');
    const { TermFactory } = await import('../src/nar/terms/factory.js');
    
    const result = parse('(animal-->"living being").', { termFactory: TermFactory });
    expect(result).toBeDefined();
  });
});
