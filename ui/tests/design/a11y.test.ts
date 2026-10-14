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

  it('declares the dialog role for every overlay surface that opts into a11y', () => {
    const overlays = getSurfaces().filter((descriptor) => descriptor.placement === 'overlay');
    expect(overlays.length).toBeGreaterThan(0);
    const withA11y = overlays.filter((overlay) => overlay.a11y?.role);
    expect(withA11y.length).toBeGreaterThan(0);
    for (const overlay of withA11y) expect(surfaceA11y(overlay).role).toBe('dialog');
  });

  it('preserves the tool-approval overlay a11y through registration (P2 regression)', () => {
    const toolApproval = getSurfaces().find((descriptor) => descriptor.id === 'tool-approval');
    expect(toolApproval).toBeDefined();
    expect(toolApproval?.a11y?.role).toBe('dialog');
    expect(surfaceA11y(toolApproval!).role).toBe('dialog');
  });

  it('rejects a missing label, a missing role, and a silent keyboard opt-out', () => {
    const base = { surface: 'x', tag: 's-x', role: 'region', label: 'X', keyboard: true };
    expect(() => validateSurfaceA11y([{ ...base, label: '' }])).toThrow(/label/);
    expect(() => validateSurfaceA11y([{ ...base, role: '' }])).toThrow(/role/);
    expect(() => validateSurfaceA11y([{ ...base, keyboard: false }])).toThrow(/keyboard/);
    expect(() => validateSurfaceA11y([{ ...base, keyboard: false, keyboardReason: 'read-only ticker' }])).not.toThrow();
  });
});
