/**
 * The command registry (§3.5, Phase 0.5). The palette, keyboard shortcuts and
 * future agent `ui.command` all read this one source. Commands are derived from
 * the registries that already exist — renderers, overlays and graph view actions
 * — so a new renderer or overlay appears in the palette without an edit here;
 * explicit commands register themselves into the same list.
 */

import { eventBus } from './events.js';
import { overlays } from './overlay-registry.js';
import { $activeRenderer } from './store.js';
import { workspaceRenderers } from './workspace-renderer.js';

export interface Command {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  /** Extra search terms (never shown). */
  readonly keywords?: string;
  run(): void;
  /** A command that only makes sense in some state can hide itself. */
  available?(): boolean;
}

const registry = new Map<string, Command>();

export const registerCommand = (command: Command): void => {
  registry.set(command.id, command);
};

export const registeredCommands = (): Command[] => [...registry.values()];

/** Commands whose existence derives from another registry. */
const derivedCommands = (): Command[] => [
  ...workspaceRenderers().map(
    (renderer): Command => ({
      id: `renderer.${renderer.id}`,
      title: `Switch to ${renderer.label}`,
      group: 'View',
      keywords: `renderer view mode ${renderer.id}`,
      run: () => $activeRenderer.set(renderer.id),
    })
  ),
  ...overlays()
    .filter((overlay) => !overlay.hiddenInPalette)
    .map(
      (overlay): Command => ({
        id: `overlay.${overlay.id}`,
        title: overlay.title,
        group: 'Open',
        keywords: `overlay panel open ${overlay.id}`,
        run: () => eventBus.emit('overlay:open', { id: overlay.id }),
      })
    ),
  {
    id: 'view.fit',
    title: 'Fit view',
    group: 'View',
    keywords: 'graph zoom fit',
    run: () => eventBus.emit('graph:fit'),
    available: () => $activeRenderer.get() === 'graph',
  },
  {
    id: 'view.minimap',
    title: 'Toggle minimap',
    group: 'View',
    keywords: 'graph minimap overview',
    run: () => eventBus.emit('graph:minimap-toggle'),
    available: () => $activeRenderer.get() === 'graph',
  },
];

/** Every command the palette may offer right now, explicit then derived. */
export const activeCommands = (): Command[] =>
  [...registeredCommands(), ...derivedCommands()].filter(
    (command) => command.available?.() ?? true
  );
