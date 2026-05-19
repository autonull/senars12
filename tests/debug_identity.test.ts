import {describe, it, expect} from '@jest/globals';
import * as parser1 from '../src/nar/terms/peggy-generated.js';
import * as parser2 from '../src/nar/terms/peggy-generated.js';

describe('Identity test', () => {
  it('should be same module', () => {
    console.log('parser1.parse:', parser1.parse);
    console.log('parser2.parse:', parser2.parse);
    console.log('Same?', parser1.parse === parser2.parse);
    expect(parser1.parse).toBe(parser2.parse);
  });
});
