import { afterEach, describe, expect, it } from 'vitest';
import {
  $capabilities,
  CAPABILITY_IDS,
  capabilityDescriptors,
  capabilityGate,
  defaultCapabilities,
  setCapability,
} from '../../src/client/core/capabilities.js';
import { $activeRenderer } from '../../src/client/core/store.js';

afterEach(() => {
  $capabilities.set(defaultCapabilities());
  $activeRenderer.set('graph');
});

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

  it('reframes the workspace when a renderer capability toggles (§2.5)', () => {
    setCapability('reasoning', true);
    expect($activeRenderer.get()).toBe('graph');
    setCapability('reasoning', false);
    expect($activeRenderer.get()).toBe('notebook');
  });

  it('leaves the renderer alone when an unrelated capability toggles', () => {
    $activeRenderer.set('graph');
    setCapability('tools', true);
    expect($activeRenderer.get()).toBe('graph');
  });
});
