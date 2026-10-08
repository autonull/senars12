import { describe, expect, it } from 'vitest';
import { tokenizeInline } from '../../src/client/core/inline-text.js';

describe('tokenizeInline (§1.4)', () => {
  it('passes plain text through as one token', () => {
    expect(tokenizeInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('splits code, strong, emphasis and links', () => {
    expect(tokenizeInline('a `x` **b** *c* [d](https://e)')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'code', value: 'x' },
      { type: 'text', value: ' ' },
      { type: 'strong', value: 'b' },
      { type: 'text', value: ' ' },
      { type: 'em', value: 'c' },
      { type: 'text', value: ' ' },
      { type: 'link', value: 'd', href: 'https://e' },
    ]);
  });

  it('supports underscore emphasis and leaves a stray marker as text', () => {
    expect(tokenizeInline('_x_ and *')).toEqual([
      { type: 'em', value: 'x' },
      { type: 'text', value: ' and *' },
    ]);
  });

  it('tokenizes a bare [n] reference as a citation, not a link', () => {
    expect(tokenizeInline('see [1] and [iso-42001]')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'citation', key: '1' },
      { type: 'text', value: ' and ' },
      { type: 'citation', key: 'iso-42001' },
    ]);
  });
});
