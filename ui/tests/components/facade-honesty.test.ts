import { describe, expect, it } from 'vitest';
import type { ToolCall } from '@senars/util';
import {
  approveCurrent,
  currentApproval,
  executeToolCall,
  registerTool,
  rejectCurrent,
} from '../../src/client/core/tool-registry.js';
import { overlayDescriptor } from '../../src/client/core/overlay-registry.js';
import { activeCommands, paletteCommands } from '../../src/client/core/commands.js';
import { setCapability } from '../../src/client/core/capabilities.js';
// Registering the overlay modules is what the palette derives from.
import '../../src/client/components/overlays/index.js';

const gated = (name: string, executed: unknown[]) =>
  registerTool({
    name,
    title: name,
    description: 'test',
    approval: true,
    parameters: { type: 'object', properties: {} },
    execute: async (args) => {
      executed.push(args);
      return 'done';
    },
  });

const callTo = (name: string, args: Record<string, unknown> = {}): ToolCall => ({
  toolCallId: `call_${name}`,
  toolName: name,
  args,
});

describe('gated tools never run before approval', () => {
  it('awaits the user, then executes with the approved args', async () => {
    const executed: unknown[] = [];
    gated('gated_approve', executed);

    const pending = executeToolCall(callTo('gated_approve', { a: 1 }));
    await Promise.resolve();

    expect(executed).toHaveLength(0);
    expect(currentApproval()?.name).toBe('gated_approve');

    approveCurrent({ a: 2 });
    await expect(pending).resolves.toBe('done');
    expect(executed).toEqual([{ a: 2 }]);
  });

  it('rejects without executing when the user cancels', async () => {
    const executed: unknown[] = [];
    gated('gated_reject', executed);

    const pending = executeToolCall(callTo('gated_reject'));
    await Promise.resolve();

    rejectCurrent();
    await expect(pending).rejects.toThrow('User cancelled');
    expect(executed).toHaveLength(0);
  });
});

describe('ref-dependent overlays are not bare palette entries', () => {
  const REF_DEPENDENT = ['explain', 'artifact', 'related', 'block-menu', 'tool-approval'] as const;

  it('stays registered and reachable, but palette-hidden', () => {
    for (const id of REF_DEPENDENT) {
      const descriptor = overlayDescriptor(id);
      expect(descriptor, `${id} should still be registered`).toBeDefined();
      expect(descriptor?.hiddenInPalette, `${id} should be palette-hidden`).toBe(true);
    }
  });

  it('is absent from the palette command list', () => {
    const ids = new Set(paletteCommands().map((command) => command.id));
    for (const id of REF_DEPENDENT) {
      expect(ids.has(`overlay.${id}`), `overlay.${id} should not be a palette command`).toBe(false);
    }
  });
});

describe('control caps match the wired control path', () => {
  it('offers retract and revise (both routed to the engine) but not the operations the server refuses', () => {
    setCapability('reasoning', true);
    const ids = new Set(activeCommands().map((command) => command.id));
    expect(ids.has('reasoning.retract')).toBe(true);
    expect(ids.has('reasoning.revise')).toBe(true);
    expect(ids.has('reasoning.adjust-budget')).toBe(false);
    expect(ids.has('reasoning.adjust-provider')).toBe(false);
  });
});
