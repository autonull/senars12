import { BUILTIN_LENS_IDS, builtinLensSpecs } from '@senars/core/lens-schema';
import { CHANNELS, type Delta } from '@senars/ui/client/modulation/types';
import {
  builtinLensSpec,
  CHANNEL_CATALOG,
  CHANNEL_IDS,
  LENS_CATALOG,
  LENS_IDS,
  lensMeta,
  PRIMARY_LENSES,
  SCALE_MAP_CATALOG,
  SCALE_MAP_IDS,
  validateLens,
} from '@senars/ui/client/utils/lens-catalog';
import {
  RENDERER_CAPABILITIES,
  supportsChannel,
  unsupportedChannels,
} from '@senars/ui/client/utils/renderer-capabilities';
import { describe, expect, it } from 'vitest';

describe('lensCatalog — coverage', () => {
  it('has one descriptor per built-in lens and no unknown keys', () => {
    expect(Object.keys(LENS_CATALOG).sort()).toEqual([...BUILTIN_LENS_IDS].sort());
    expect([...LENS_IDS].sort()).toEqual([...BUILTIN_LENS_IDS].sort());
  });

  it('covers every lens returned by the core spec list', () => {
    expect(builtinLensSpecs().map((spec) => spec.id).sort()).toEqual([...BUILTIN_LENS_IDS].sort());
  });

  it('exposes the spec as the descriptor body', () => {
    for (const id of LENS_IDS) {
      expect(LENS_CATALOG[id].spec).toBe(builtinLensSpec(id));
      expect(LENS_CATALOG[id].id).toBe(id);
    }
  });

  it('only marks known lenses as primary', () => {
    const primary = LENS_IDS.filter((id) => LENS_CATALOG[id].primary);
    expect(PRIMARY_LENSES.map((lens) => lens.id)).toEqual(primary);
    for (const lens of PRIMARY_LENSES) expect(lens.primary).toBe(true);
  });

  it('returns undefined for an unknown lens', () => {
    expect(lensMeta('nope')).toBeUndefined();
    expect(builtinLensSpec('nope')).toBeUndefined();
  });
});

describe('lensCatalog — metadata', () => {
  it('uses non-empty presentation for every lens', () => {
    for (const id of LENS_IDS) {
      const lens = LENS_CATALOG[id];
      expect(lens.label.length).toBeGreaterThan(0);
      expect(lens.description.length).toBeGreaterThan(0);
      expect(lens.color.length).toBeGreaterThan(0);
      expect(lens.defaultLayout.length).toBeGreaterThan(0);
    }
  });
});

describe('lensCatalog — validation', () => {
  it('accepts a well-formed lens and returns the parsed spec', () => {
    const result = validateLens({
      id: 'custom',
      label: 'Custom',
      description: 'A custom lens',
      modulation: { op: 'const', value: 1 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.id).toBe('custom');
  });

  it('rejects a malformed lens with a path-qualified error', () => {
    const result = validateLens({ label: '', modulation: { op: 'nope' } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('id');
  });
});

describe('lensCatalog — channel vocabulary', () => {
  it('covers exactly the modulation channels', () => {
    expect([...CHANNEL_IDS].sort()).toEqual([...CHANNELS].sort());
  });

  it('declares every channel with a label and a valid target', () => {
    const targets = new Set(['node', 'edge', 'both']);
    for (const channel of CHANNEL_IDS) {
      expect(CHANNEL_CATALOG[channel].label.length).toBeGreaterThan(0);
      expect(targets.has(CHANNEL_CATALOG[channel].target)).toBe(true);
    }
  });

  it('has a labelled scale map for every declared id', () => {
    expect(SCALE_MAP_IDS.length).toBeGreaterThan(0);
    for (const id of SCALE_MAP_IDS) expect(SCALE_MAP_CATALOG[id].label.length).toBeGreaterThan(0);
  });
});

describe('renderer capabilities', () => {
  it('declares node and edge support for both renderers, within the channel vocabulary', () => {
    for (const renderer of ['2d', '3d'] as const) {
      for (const target of ['node', 'edge'] as const) {
        const supported = RENDERER_CAPABILITIES[renderer][target];
        expect(supported.size).toBeGreaterThan(0);
        for (const channel of supported) expect(CHANNELS).toContain(channel);
      }
    }
  });

  it('answers supportsChannel consistently with the matrix', () => {
    expect(supportsChannel('2d', 'node', 'stroke.dash')).toBe(true);
    expect(supportsChannel('3d', 'node', 'stroke.dash')).toBe(false);
    expect(supportsChannel('3d', 'edge', 'width')).toBe(true);
    expect(supportsChannel('2d', 'edge', 'size')).toBe(false);
  });

  it('reports channels a renderer cannot paint, per element kind', () => {
    const delta: Delta = new Map([
      ['node:a', { label: 'a', 'stroke.dash': 1 }],
      ['edge:b', { width: 2, 'flow.enable': true }],
    ]);
    const isEdge = (id: string) => id.startsWith('edge:');
    expect(unsupportedChannels(delta, '3d', isEdge).sort()).toEqual(['flow.enable', 'stroke.dash']);
    expect(unsupportedChannels(delta, '2d', isEdge)).toEqual(['flow.enable']);
  });
});