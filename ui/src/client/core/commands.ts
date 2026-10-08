/**
 * The command registry (§3.5, Phase 0.5). The palette, keyboard shortcuts and
 * future agent `ui.command` all read this one source. Commands are derived from
 * the registries that already exist — renderers, overlays and graph view actions
 * — so a new renderer or overlay appears in the palette without an edit here;
 * explicit commands register themselves into the same list.
 */

import { recordCommandUse } from './command-history.js';
import { eventBus } from './events.js';
import { overlays } from './overlay-registry.js';
import { $activeRenderer, $panels } from './store.js';
import { workspaceRenderers } from './workspace-renderer.js';

export type CommandArgs = Record<string, unknown>;

const PANEL_LABELS: Record<string, string> = {
  chat: 'Chat History',
  search: 'Search',
  'lens-designer': 'Lens Designer',
};

const togglePanel = (id: string): void => {
  const panels = new Map($panels.get());
  const panel = panels.get(id);
  if (!panel) return;
  panels.set(id, { ...panel, open: !panel.open });
  $panels.set(panels);
};

export interface Command {
  readonly id: string;
  readonly title: string;
  readonly group: string;
  /** Extra search terms (never shown). */
  readonly keywords?: string;
  run(args?: CommandArgs): void;
  /** Validate/coerce the caller's args (agent `ui.command`); throw to reject. */
  parse?(args: CommandArgs): CommandArgs;
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
        run: (args) =>
          eventBus.emit('overlay:open', {
            id: overlay.id,
            ...(args as { ref?: string; anchor?: HTMLElement } | undefined),
          }),
      })
    ),
  ...[...$panels.get().keys()].map(
    (id): Command => ({
      id: `view.panel.${id}`,
      title: `Toggle ${PANEL_LABELS[id] ?? id}`,
      group: 'View',
      keywords: `panel toggle show hide ${id}`,
      run: () => togglePanel(id),
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

/**
 * Run a command by id, respecting availability, and report whether it ran. This
 * is the seam the agent `ui.command` (§3.6) and any programmatic caller use, so
 * every palette command is agent-settable without a second registry. A command
 * may declare `parse` to validate/coerce args; a rejection is reported, not thrown.
 */
export const dispatchCommand = (id: string, args: CommandArgs = {}): boolean => {
  const command = activeCommands().find((candidate) => candidate.id === id);
  if (!command) return false;
  try {
    command.run(command.parse ? command.parse(args) : args);
  } catch (error) {
    console.warn(`[command] ${id} rejected its args`, error);
    return false;
  }
  recordCommandUse(id);
  return true;
};
