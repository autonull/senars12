import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/settings.js';
import '../../src/client/components/overlays/telemetry.js';
import { activeCommands, dispatchCommand } from '../../src/client/core/commands.js';
import { overlayDescriptor } from '../../src/client/core/overlay-registry.js';
import { $panels } from '../../src/client/core/store.js';

const initialChatOpen = $panels.get().get('chat')?.open;
const isOpen = (id: string) => $panels.get().get(id)?.open;

afterEach(() => {
  const panels = new Map($panels.get());
  for (const [id, panel] of panels) panels.set(id, { ...panel, open: false });
  $panels.set(panels);
});

describe('panel commands (0.4)', () => {
  it('defaults diagnostic panels to closed (§1)', () => {
    expect(initialChatOpen).toBe(false);
  });

  it('retires the standing config and telemetry panels for overlays', () => {
    expect($panels.get().has('config')).toBe(false);
    expect($panels.get().has('telemetry')).toBe(false);
    expect(overlayDescriptor('settings')).toBeDefined();
    expect(overlayDescriptor('telemetry')).toBeDefined();
  });

  it('derives a toggle command for every panel', () => {
    const ids = activeCommands().map((command) => command.id);
    for (const id of $panels.get().keys()) {
      expect(ids).toContain(`view.panel.${id}`);
    }
  });

  it('toggles a demoted panel through the palette/agent command', () => {
    expect(dispatchCommand('view.panel.chat')).toBe(true);
    expect(isOpen('chat')).toBe(true);
    expect(dispatchCommand('view.panel.chat')).toBe(true);
    expect(isOpen('chat')).toBe(false);
  });

  it('ignores a panel command for an unknown panel', () => {
    expect(dispatchCommand('view.panel.ghost')).toBe(false);
  });
});
