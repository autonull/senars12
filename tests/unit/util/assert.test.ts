import { assertDefined, invariant } from '@senars/util/utils/assert';
import { describe, expect, it } from 'vitest';

describe('invariant', () => {
  it('passes through on truthy condition', () => {
    expect(() => invariant(true, 'should not throw')).not.toThrow();
  });

  it('throws with message on falsy condition', () => {
    expect(() => invariant(false, 'nope')).toThrow('nope');
  });

  it('narrows control flow after assertion', () => {
    const value: string | null = 'x';
    invariant(value, 'required');
    expect(value.length).toBe(1);
  });
});

describe('assertDefined', () => {
  it('passes through on non-null value', () => {
    expect(() => assertDefined(5, 'need number')).not.toThrow();
  });

  it('throws on null', () => {
    expect(() => assertDefined(null, 'was null')).toThrow('was null');
  });

  it('throws on undefined', () => {
    expect(() => assertDefined(undefined, 'was undefined')).toThrow('was undefined');
  });

  it('narrows type after assertion', () => {
    const v: number | undefined = 3;
    assertDefined(v, 'need it');
    expect(v + 1).toBe(4);
  });
});
