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
});
