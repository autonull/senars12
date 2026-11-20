import { describe, it, expect } from 'vitest';
import { LM_PROVIDER_NAMES } from '@senars/lm';

describe('LM_PROVIDER_NAMES import', () => {
  it('should be defined', () => {
    console.log('LM_PROVIDER_NAMES:', LM_PROVIDER_NAMES);
    expect(LM_PROVIDER_NAMES).toBeDefined();
    expect(Array.isArray(LM_PROVIDER_NAMES)).toBe(true);
    expect(LM_PROVIDER_NAMES.length).toBeGreaterThan(0);
  });
});
