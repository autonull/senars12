import {describe, it, expect} from '@jest/globals';
import { termParser } from '../src/nar/terms/parser-peggy.js';
import { TermFactory } from '../src/nar/terms/factory.js';

describe('Parser state', () => {
  it('should parse first time', () => {
    console.log('Parser termFactory before:', typeof (termParser as any).termFactory);
    const result = termParser.parse('(cat-->animal).');
    console.log('First parse result:', result.kind);
    expect(result).toBeDefined();
  });

  it('should parse second time', () => {
    console.log('Parser termFactory before:', typeof (termParser as any).termFactory);
    const result = termParser.parse('(animal-->"living being").');
    console.log('Second parse result:', result.kind);
    expect(result).toBeDefined();
  });
});
