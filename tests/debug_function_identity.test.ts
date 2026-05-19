import {describe, it, expect} from '@jest/globals';

describe('Function identity', () => {
  it('should check function identity', async () => {
    const mod1 = await import('../src/nar/terms/peggy-generated.js');
    const mod2 = await import('../src/nar/terms/peggy-generated.js');
    
    console.log('mod1.parse === mod2.parse:', mod1.parse === mod2.parse);
    console.log('mod1.parse:', mod1.parse);
    console.log('mod2.parse:', mod2.parse);
    
    // They should be the same function (module caching)
    expect(mod1.parse).toBe(mod2.parse);
  });
});
