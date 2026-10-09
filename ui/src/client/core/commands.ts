/**
 * The command registry (§3.5, Phase 0.5). The palette, keyboard shortcuts and
 * future agent `ui.command` all read this one source. Commands are derived from
 * the registries that already exist — renderers, overlays and graph view actions
 * — so a new renderer or overlay appears in the palette without an edit here;
 * explicit commands register themselves into the same list.
 */

import { capabilityGate } from './capabilities.js';
import { recordCommandUse } from './command-history.js';
import { eventBus } from './events.js';
import { overlays } from './overlay-registry.js';
import { foldableSections, sectionTree } from './sections.js';
import { narsBackend } from './nars-backend.js';
import {
  $activeRenderer,
  $collapsedBlocks,
  $panels,
  $workspaceGraph,
  setCollapsed,
} from './store.js';
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
  /** Keep the command dispatchable but out of the palette list (e.g. the palette itself). */
  readonly paletteHidden?: boolean;
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
    .map((overlay): Command => {
      const gate = overlay.capability;
      return {
        id: `overlay.${overlay.id}`,
        title: overlay.title,
        group: 'Open',
        keywords: `overlay panel open ${overlay.id}`,
        run: (args) =>
          eventBus.emit('overlay:open', {
            id: overlay.id,
            ...(args as { ref?: string; anchor?: HTMLElement } | undefined),
          }),
        available: gate ? () => capabilityGate(gate) : undefined,
      };
    }),
  {
    // The palette excludes itself from its own list, but the HUD button and the
    // ⌘K shortcut still reach it through the same dispatch seam as every overlay.
    id: 'overlay.palette',
    title: 'Command palette',
    group: 'Open',
    keywords: 'command palette shortcut',
    paletteHidden: true,
    run: (args) =>
      eventBus.emit('overlay:open', {
        id: 'palette',
        ...(args as { ref?: string; anchor?: HTMLElement } | undefined),
      }),
  },
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
  {
    id: 'overlay.pin',
    title: 'Pin/unpin top overlay',
    group: 'View',
    keywords: 'overlay pin float card stay open',
    run: () => eventBus.emit('overlay:pin-toggle'),
  },
  {
    id: 'view.fold-all',
    title: 'Fold/unfold all sections',
    group: 'View',
    keywords: 'notebook fold unfold sections collapse expand',
    run: () => {
      const sections = new Set(foldableSections(sectionTree($workspaceGraph.get())));
      const collapsed = $collapsedBlocks.get();
      const allFolded = [...sections].every((ref) => collapsed.has(ref));
      setCollapsed(allFolded ? new Set() : sections);
    },
    available: () => foldableSections(sectionTree($workspaceGraph.get())).length > 0,
  },
];

/** Reasoning is gated on the `reasoning` capability and the backend's caps. */
const reasoningAvailable = (): boolean => capabilityGate('reasoning');
const caps = () => narsBackend.caps;

/** Steer/author commands — only available when the reasoning capability is enabled
 * and the backend supports the specific operation. */
registerCommand({
  id: 'reasoning.submit',
  title: 'Submit to reasoner',
  group: 'Reasoning',
  keywords: 'reasoning submit belief goal question nars',
  run: (args) =>
    narsBackend.control?.submit({
      term: String(args.term ?? ''),
      mode: (args.mode as 'belief' | 'goal' | 'question') ?? 'belief',
    }),
  parse: (args) => ({
    term: String(args.term ?? ''),
    mode: (args.mode as 'belief' | 'goal' | 'question') ?? 'belief',
  }),
  available: () => reasoningAvailable() && caps().canSubmit,
});

registerCommand({
  id: 'reasoning.step',
  title: 'Step reasoner',
  group: 'Reasoning',
  keywords: 'reasoning step inference nars',
  run: () => narsBackend.control?.step(),
  available: () => reasoningAvailable() && caps().canStep,
});

registerCommand({
  id: 'reasoning.run',
  title: 'Run reasoner',
  group: 'Reasoning',
  keywords: 'reasoning run inference nars',
  run: () => narsBackend.control?.run(),
  available: () => reasoningAvailable() && caps().canRun,
});

registerCommand({
  id: 'reasoning.retract',
  title: 'Retract belief',
  group: 'Reasoning',
  keywords: 'reasoning retract belief remove nars',
  run: (args) => narsBackend.control?.retract(String(args.nodeId ?? '')),
  parse: (args) => ({ nodeId: String(args.nodeId ?? '') }),
  available: () => reasoningAvailable() && caps().canRetract,
});

registerCommand({
  id: 'reasoning.revise',
  title: 'Revise belief',
  group: 'Reasoning',
  keywords: 'reasoning revise belief truth frequency confidence nars',
  run: (args) =>
    narsBackend.control?.revise(
      String(args.nodeId ?? ''),
      Number(args.frequency ?? 0),
      Number(args.confidence ?? 0)
    ),
  parse: (args) => ({
    nodeId: String(args.nodeId ?? ''),
    frequency: Number(args.frequency ?? 0),
    confidence: Number(args.confidence ?? 0),
  }),
  available: () => reasoningAvailable() && caps().canRevise,
});

registerCommand({
  id: 'reasoning.add-goal',
  title: 'Add goal',
  group: 'Reasoning',
  keywords: 'reasoning add goal nars',
  run: (args) => narsBackend.control?.addGoal(String(args.term ?? '')),
  parse: (args) => ({ term: String(args.term ?? '') }),
  available: () => reasoningAvailable() && caps().canAddGoal,
});

registerCommand({
  id: 'reasoning.adjust-budget',
  title: 'Adjust reasoning budget',
  group: 'Reasoning',
  keywords: 'reasoning budget adjust nars',
  run: (args) => narsBackend.control?.adjustBudget(Number(args.budget ?? 0)),
  parse: (args) => ({ budget: Number(args.budget ?? 0) }),
  available: () => reasoningAvailable() && caps().canAdjustBudget,
});

registerCommand({
  id: 'reasoning.adjust-provider',
  title: 'Adjust LM provider for reasoning',
  group: 'Reasoning',
  keywords: 'reasoning provider lm switch nars',
  run: (args) => narsBackend.control?.adjustProvider(String(args.provider ?? '')),
  parse: (args) => ({ provider: String(args.provider ?? '') }),
  available: () => reasoningAvailable() && caps().canAdjustProvider,
});

/** Every command the palette may offer right now, explicit then derived. */
export const activeCommands = (): Command[] =>
  [...registeredCommands(), ...derivedCommands()].filter(
    (command) => command.available?.() ?? true
  );

/** Commands the palette lists (drops those that hide themselves from it). */
export const paletteCommands = (): Command[] =>
  activeCommands().filter((command) => !command.paletteHidden);

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
