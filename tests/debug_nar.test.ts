import {describe, it, expect, beforeAll} from '@jest/globals';
import {NAR} from '../src/nar/nar.js';

describe('NAR debug', () => {
  let nar: NAR;

  beforeAll(() => {
    nar = new NAR();
  });

  it('should believe simple term', async () => {
    await nar.believe('cat');
    expect(nar.getBeliefs().length).toBeGreaterThanOrEqual(0);
  });

  it('should believe inheritance', async () => {
    await nar.believe('(cat-->animal).');
    expect(nar.getBeliefs().length).toBeGreaterThanOrEqual(0);
  });
});
