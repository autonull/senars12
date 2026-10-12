import { describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/index.js';
import '../../src/client/components/renderers/notebook.js';
import '../../src/client/components/contradiction-badge.js';
import '../../src/client/core/view-host.js';
import { surfaceA11y, generateSurfaces, validateSurfaceA11y } from '../../src/client/core/surface-codegen.js';
import { getSurfaces } from '../../src/client/core/surface-registry.js';

describe('design: surface accessibility', () => {
  it('every registered surface exposes a label, role and keyboard path', () => {
    const targets = generateSurfaces().a11y;
    expect(targets.length).toBeGreaterThan(0);
    expect(() => validateSurfaceA11y(targets)).not.toThrow();
  });

  it('declares the dialog role for overlay surfaces', () => {
    const overlays = getSurfaces().filter((descriptor) => descriptor.group === 'overlay');
    expect(overlays.length).toBeGreaterThan(0);
    for (const overlay of overlays) expect(surfaceA11y(overlay).role).toBe('dialog');
  });

  it('rejects a missing label, a missing role, and a silent keyboard opt-out', () => {
    const base = { surface: 'x', tag: 's-x', role: 'region', label: 'X', keyboard: true };
    expect(() => validateSurfaceA11y([{ ...base, label: '' }])).toThrow(/label/);
    expect(() => validateSurfaceA11y([{ ...base, role: '' }])).toThrow(/role/);
    expect(() => validateSurfaceA11y([{ ...base, keyboard: false }])).toThrow(/keyboard/);
    expect(() => validateSurfaceA11y([{ ...base, keyboard: false, keyboardReason: 'read-only ticker' }])).not.toThrow();
  });
});
