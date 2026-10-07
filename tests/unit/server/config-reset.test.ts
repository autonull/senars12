import { DEFAULT_CONFIG } from '@senars/nar';
import { resetConfigFields } from '@senars/ui/server/config-schema';
import { describe, expect, it } from 'vitest';

describe('resetConfigFields', () => {
  it('restores every mapped field to its engine default', () => {
    const updates = resetConfigFields();
    expect(updates.maxConcepts).toBe(DEFAULT_CONFIG.maxConcepts);
    expect(updates.maxDerivationsPerStep).toBe(DEFAULT_CONFIG.maxDerivationsPerStep);
  });

  it('scopes the reset to a category', () => {
    expect(resetConfigFields('nars')).toMatchObject({ maxConcepts: DEFAULT_CONFIG.maxConcepts });
    expect(resetConfigFields('llm')).toEqual({});
  });
});
