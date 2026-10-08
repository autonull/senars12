import { afterEach, describe, expect, it } from 'vitest';
import { activeCommands, dispatchCommand } from '../../src/client/core/commands.js';
import { $panels } from '../../src/client/core/store.js';

const initialTelemetryOpen = $panels.get().get('telemetry')?.open;
const isOpen = (id: string) => $panels.get().get(id)?.open;

afterEach(() => {
  const panels = new Map($panels.get());
  for (const [id, panel] of panels) panels.set(id, { ...panel, open: false });
  $panels.set(panels);
});

describe('panel commands (0.4)', () => {
  it('defaults diagnostic panels to closed (§1)', () => {
    expect(initialTelemetryOpen).toBe(false);
  });

  it('retires the config panel in favour of the settings overlay', () => {
    expect($panels.get().has('config')).toBe(false);
  });

  it('derives a toggle command for every panel', () => {
    const ids = activeCommands().map((command) => command.id);
    for (const id of $panels.get().keys()) {
      expect(ids).toContain(`view.panel.${id}`);
    }
  });

  it('toggles a demoted panel through the palette/agent command', () => {
    expect(dispatchCommand('view.panel.telemetry')).toBe(true);
    expect(isOpen('telemetry')).toBe(true);
    expect(dispatchCommand('view.panel.telemetry')).toBe(true);
    expect(isOpen('telemetry')).toBe(false);
  });

  it('ignores a panel command for an unknown panel', () => {
    expect(dispatchCommand('view.panel.ghost')).toBe(false);
  });
});
