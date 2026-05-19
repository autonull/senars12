import {describe, it, expect} from '@jest/globals';
import { termParser } from '../src/nar/terms/parser-peggy.js';

describe('Parser debug', () => {
  it('should parse simple term', () => {
    const result = termParser.parse('cat');
    expect(result).toBeDefined();
  });

  it('should parse inheritance', () => {
    const result = termParser.parse('(cat-->animal).');
    expect(result).toBeDefined();
  });
});
