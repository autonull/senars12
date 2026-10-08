import { afterEach, describe, expect, it } from 'vitest';
import {
  $capabilities,
  CAPABILITY_IDS,
  capabilityDescriptors,
  capabilityGate,
  defaultCapabilities,
  setCapability,
} from '../../src/client/core/capabilities.js';

afterEach(() => $capabilities.set(defaultCapabilities()));

describe('capability registry', () => {
  it('defaults to the LM-only composition', () => {
    expect([...defaultCapabilities()]).toEqual(['language']);
    expect(capabilityGate('language')).toBe(true);
    expect(capabilityGate('reasoning')).toBe(false);
  });

  it('names every capability', () => {
    expect(capabilityDescriptors().map((d) => d.id)).toEqual([...CAPABILITY_IDS]);
  });

  it('toggles a capability without mutating the previous set', () => {
    const before = $capabilities.get();
    setCapability('reasoning', true);
    expect(capabilityGate('reasoning')).toBe(true);
    expect(before.has('reasoning')).toBe(false);
    setCapability('reasoning', false);
    expect(capabilityGate('reasoning')).toBe(false);
  });
});
