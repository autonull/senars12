import { SHA256_PINNED, sha256Hex, sha256HexParts, sha256Prefixed } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('sha256HexParts', () => {
  it('is order-sensitive and content-sensitive', () => {
    expect(sha256HexParts(['a', 'b'])).not.toBe(sha256HexParts(['b', 'a']));
    expect(sha256HexParts(['a', 'b'])).not.toBe(sha256HexParts(['a', 'c']));
    expect(sha256HexParts(['a', 'b'])).toBe(sha256HexParts(['a', 'b']));
  });

  it('frames each part, so no two spellings of a tuple collide', () => {
    expect(sha256HexParts(['ab', 'c'])).not.toBe(sha256HexParts(['a', 'bc']));
    expect(sha256HexParts(['a', 'b', 'c'])).not.toBe(sha256HexParts(['ab', 'c']));
    expect(sha256HexParts(['a', '', 'c'])).not.toBe(sha256HexParts(['a', 'c']));
  });

  it('separates a text part from the bytes that spell it', () => {
    expect(sha256HexParts(['5:abc'])).not.toBe(sha256HexParts(['abc']));
  });

  it('counts a string part in bytes, so text and its UTF-8 bytes are one payload', () => {
    expect(sha256HexParts(['é'])).toBe(sha256HexParts([Buffer.from('é', 'utf8')]));
    expect(sha256HexParts([new Uint8Array([1, 2])])).toBe(sha256HexParts([new Uint8Array([1, 2])]));
  });

  it('frames a single part too, so it is not the bare digest of that text', () => {
    expect(sha256HexParts([])).toBe(sha256Hex(''));
    expect(sha256HexParts(['abc'])).not.toBe(sha256Hex('abc'));
  });
});

describe('the single-part digests', () => {
  it('pins the algorithm for a bare payload', () => {
    expect(sha256Hex('abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Prefixed('abc')).toBe(`sha256:${sha256Hex('abc')}`);
    expect(sha256Prefixed('abc')).toMatch(SHA256_PINNED);
  });
});
