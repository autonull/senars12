import { describe, expect, it } from 'vitest';
import { createGraph2DRenderer } from '../src/index.js';
import {
  registerCoreFocusKinds,
  registerFocusKind,
  focusKindIds,
} from '@senars/ui-contract/framework';
import { registerCoreChannels, registerChannel, channelIds } from '@senars/ui-contract/modulation';

describe('ui-backend-2d smoke', () => {
  it('creates a contract-based 2D renderer', () => {
    const r = createGraph2DRenderer();
    const host = document.createElement('div');
    r.mount(host, {
      projection: { focus: { kind: 'mind' } as never, aspect: 'content', depth: 0, time: { t: 0 } as never },
      theme: {},
      flags: {} as never,
      timeline: { t: 0 } as never,
      openOverlay: () => {},
      openPalette: () => {},
      renderer: r.id,
      setRenderer: () => {},
      overlays: () => [],
      hasOverlays: () => false,
      dispatch: () => false,
      focus: () => {},
      select: () => {},
      embed: () => {},
    });
    r.present([], []);
    const snap = r.snapshot();
    expect(snap.renderer).toBe('graph-2d');
    expect(r.capabilities().parity).toBe('full');
  });

  it('supports registering a custom focus kind + channel', () => {
    registerCoreFocusKinds();
    registerCoreChannels();
    const kind = 'toy-focus';
    const channel = 'toy-channel';
    registerFocusKind({
      kind,
      key: (ref) => `${kind}:${(ref as { id?: string }).id ?? ''}`,
      label: () => 'Toy Focus',
    });
    registerChannel({ id: channel, of: 'node', value: 'string', fallback: 'x' });
    expect(focusKindIds()).toContain(kind);
    expect(channelIds()).toContain(channel);
  });
});
