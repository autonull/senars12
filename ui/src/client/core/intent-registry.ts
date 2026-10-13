/**
 * Intent registry — unified catalog replacing UiSignals (events.ts) + Command registry (commands.ts).
 *
 * This is the single source of truth for all dispatchable actions in the UI.
 * Every palette command, keyboard shortcut, agent ui.command, and eventBus signal
 * is defined here as an Intent.
 */
import { z } from 'zod';
import {
  defineIntentCatalog,
  intent,
  signal,
  command,
  type IntentDescriptor,
  type IntentCatalog,
  type IntentPayload,
} from '../framework/intent';
import { capabilityGate } from './capabilities';
import { recordCommandUse } from './command-history';
import { eventBus } from './events';
import { surfaceRegistry, registerSurface } from '../framework/surface';
import { foldableSections, sectionTree } from './sections';
import { narsBackend } from './nars-backend';
import { workspaceRenderers } from './workspace-renderer';
import {
  $activeRenderer,
  $capabilities,
  $collapsedBlocks,
  $controlMode,
  $panels,
  $reasoningRunning,
  $runTerminations,
  $workspaceGraph,
  $conversationLayout,
  $selectedNodeIds,
} from './index.js';
import { setConversationLayout, setCollapsed } from './store.js';
import { availableComposerModes, type ComposerMode } from './composer-modes.js';
import { panelDef, PANEL_KINDS } from './panel-defs.js';
import { validateCommandArgs } from './command-schemas.js';
import { atom } from './store.js';

// ===== Signal Intents (fire-and-forget, no palette entry) =====

const graphSearch = signal('graph:search', 'Search graph', 'Graph', (query: string) => {
  eventBus.emit('graph:search', query);
});

const graphLayout = signal('graph:layout', 'Set graph layout', 'Graph', (layout: string) => {
  eventBus.emit('graph:layout', layout);
});

const graphPanTo = signal('graph:pan-to', 'Pan graph', 'Graph', (pos: { x: number; y: number }) => {
  eventBus.emit('graph:pan-to', pos);
});

const graphZoomIn = signal('graph:zoom-in', 'Zoom in', 'Graph', () => {
  eventBus.emit('graph:zoom-in');
});

const graphZoomOut = signal('graph:zoom-out', 'Zoom out', 'Graph', () => {
  eventBus.emit('graph:zoom-out');
});

const graphFit = signal('graph:fit', 'Fit view', 'Graph', () => {
  eventBus.emit('graph:fit');
});

const graphMinimapToggle = signal('graph:minimap-toggle', 'Toggle minimap', 'Graph', () => {
  eventBus.emit('graph:minimap-toggle');
});

const graphLegendToggle = signal('graph:legend-toggle', 'Toggle legend', 'Graph', () => {
  eventBus.emit('graph:legend-toggle');
});

const overlayOpen = signal('overlay:open', 'Open overlay', 'Overlay', (args: { id: string; ref?: string; anchor?: HTMLElement }) => {
  eventBus.emit('overlay:open', args);
});

const overlayClose = signal('overlay:close', 'Close overlay', 'Overlay', (args: { id?: string } = {}) => {
  eventBus.emit('overlay:close', args);
});

const overlayPin = signal('overlay:pin', 'Pin/unpin overlay', 'Overlay', (args: { id: string; pinned: boolean }) => {
  eventBus.emit('overlay:pin', args);
});

const overlayPinToggle = signal('overlay:pin-toggle', 'Pin/unpin top overlay', 'Overlay', () => {
  eventBus.emit('overlay:pin-toggle');
});

const overlayMinimize = signal('overlay:minimize', 'Minimize/restore overlay', 'Overlay', (args: { id: string; minimize: boolean }) => {
  eventBus.emit('overlay:minimize', args);
});

const overlayMaximize = signal('overlay:maximize', 'Maximize/restore overlay', 'Overlay', (args: { id: string; maximize: boolean }) => {
  eventBus.emit('overlay:maximize', args);
});

const overlayCascade = signal('overlay:cascade', 'Cascade windows', 'Overlay', (args: { offset?: number } = {}) => {
  eventBus.emit('overlay:cascade', args);
});

const overlayTile = signal('overlay:tile', 'Tile windows', 'Overlay', () => {
  eventBus.emit('overlay:tile');
});

const composerFocus = signal('composer:focus', 'Focus composer', 'Composer', (args: { refs?: string[]; mode?: string } = {}) => {
  eventBus.emit('composer:focus', args);
});

const composerOpen = signal('composer:open', 'Open composer', 'Composer', (args: { position?: { x: number; y: number }; anchor?: string } = {}) => {
  eventBus.emit('composer:open', args);
});

const composerMode = signal('composer:mode', 'Set composer mode', 'Composer', (args: { mode: string }) => {
  eventBus.emit('composer:mode', args);
});

const composerPrefill = signal('composer:prefill', 'Prefill composer', 'Composer', (args: { content: string; mode?: string; refs?: string[] }) => {
  eventBus.emit('composer:prefill', args);
});

const testResetAll = signal('test:reset-all', 'Reset all test state', 'Test', () => {
  eventBus.emit('test:reset-all');
});

const testStep = signal('test:step', 'Single engine step', 'Test', () => {
  eventBus.emit('test:step');
});

const viewFit = signal('view:fit', 'Fit view (alias)', 'View', () => {
  eventBus.emit('view:fit');
});

const appError = signal('app-error', 'Application error', 'App', (args: { message: string; detail?: string; error?: object }) => {
  eventBus.emit('app-error', args);
});

// ===== Command Intents (with args, validation, palette entry) =====

const togglePanel = (id: string): void => {
  const panels = new Map($panels.get());
  const panel = panels.get(id);
  if (!panel) return;
  panels.set(id, { ...panel, open: !panel.open });
  $panels.set(panels);
};

// Derived renderer commands
const rendererCommands = (): IntentDescriptor[] =>
  workspaceRenderers()
    .filter((renderer) => {
      const caps = renderer.capabilities();
      return !caps.requiredCapability || capabilityGate(caps.requiredCapability);
    })
    .map(
      (renderer): IntentDescriptor => command(
        `renderer.${renderer.id}`,
        `Switch to ${renderer.label}`,
        'View',
        () => $activeRenderer.set(renderer.id),
        {
          available: () => {
            const caps = renderer.capabilities();
            return !caps.requiredCapability || capabilityGate(caps.requiredCapability);
          },
          keywords: `renderer view mode ${renderer.id}`,
        }
      )
    );

// Derived overlay commands
const overlayCommands = (): IntentDescriptor[] =>
  surfaceRegistry.ids
    .filter((id) => {
      const surface = surfaceRegistry.get(id);
      // Exclude palette surface - it's defined in staticIntents with paletteHidden: true
      return surface && !(surface as any).hiddenInPalette && surface.id !== 'palette';
    })
    .map((id): IntentDescriptor => {
      const surface = surfaceRegistry.get(id)!;
      const gate = surface.capability;
      return command(
        `overlay.${surface.id}`,
        surface.title,
        'Open',
        (args) => eventBus.emit('overlay:open', { id: surface.id, ...(args as { ref?: string; anchor?: HTMLElement } | undefined) }),
        {
          available: gate ? () => capabilityGate(gate as any) : undefined,
          keywords: `overlay panel open ${surface.id}`,
        }
      );
    });

// Panel commands
const panelCommands: IntentDescriptor[] = PANEL_KINDS.map((id): IntentDescriptor =>
  command(
    `view.panel.${id}`,
    `Toggle ${panelDef(id).label}`,
    'View',
    () => togglePanel(id),
    {
      keywords: `panel toggle show hide ${id}`,
    }
  )
);

// View commands
const viewFitCmd = command(
  'view.fit',
  'Fit view',
  'View',
  () => eventBus.emit('graph:fit'),
  {
    available: () => $activeRenderer.get() === 'graph',
    keywords: 'graph zoom fit',
  }
);

const viewMinimap = command(
  'view.minimap',
  'Toggle minimap',
  'View',
  () => eventBus.emit('graph:minimap-toggle'),
  {
    available: () => $activeRenderer.get() === 'graph',
    keywords: 'graph minimap overview',
  }
);

const overlayPinToggleCmd = command(
  'overlay.pin',
  'Pin/unpin top overlay',
  'View',
  () => eventBus.emit('overlay:pin-toggle'),
  {
    keywords: 'overlay pin float card stay open',
  }
);

const viewFoldAll = command(
  'view.fold-all',
  'Fold/unfold all sections',
  'View',
  () => {
    const sections = new Set(foldableSections(sectionTree($workspaceGraph.get())));
    const collapsed = $collapsedBlocks.get();
    const allFolded = [...sections].every((ref) => collapsed.has(ref));
    setCollapsed(allFolded ? new Set() : sections);
  },
  {
    available: () => foldableSections(sectionTree($workspaceGraph.get())).length > 0,
    keywords: 'notebook fold unfold sections collapse expand',
  }
);

const overlayCascadeCmd = command(
  'overlay.cascade',
  'Cascade windows',
  'View',
  (args: IntentPayload = {}) => eventBus.emit('overlay:cascade', { offset: Number((args as any).offset ?? 30) }),
  {
    keywords: 'overlay window cascade arrange stack',
  }
);

const overlayTileCmd = command(
  'overlay.tile',
  'Tile windows',
  'View',
  () => eventBus.emit('overlay:tile'),
  {
    keywords: 'overlay window tile arrange grid',
  }
);

const controlModeToggle = command(
  'control.mode.toggle',
  'Toggle control mode',
  'Control',
  () => $controlMode.set(!$controlMode.get()),
  {
    available: () => capabilityGate('reasoning'),
    keywords: 'control mode toggle reasoning execute',
  }
);

const composerModeCommands = (): IntentDescriptor[] =>
  availableComposerModes($capabilities.get()).map((mode): IntentDescriptor =>
    command(
      `composer.mode.${mode.id}`,
      `Composer: ${mode.label}`,
      'Compose',
      () => eventBus.emit('composer:mode', { mode: mode.id }),
      {
        available: () => availableComposerModes($capabilities.get()).some((m) => m.id === mode.id),
        keywords: `composer mode ${mode.id} ${mode.label}`,
      }
    )
  );

const composerPrefillCmd = command(
  'composer.prefill',
  'Prefill composer',
  'Compose',
  (args: IntentPayload) => eventBus.emit('composer:prefill', { content: String((args as any).content ?? ''), mode: String((args as any).mode ?? ''), refs: ((args as any).refs as string[] | undefined) ?? [] }),
  {
    parse: (args: IntentPayload) => ({ content: String((args as any).content ?? ''), mode: String((args as any).mode ?? ''), refs: ((args as any).refs as string[] | undefined) ?? [] }),
    paletteHidden: true,
  }
);

// Reasoning commands
const reasoningAvailable = (): boolean => capabilityGate('reasoning');
const caps = () => narsBackend.caps;

const reasoningSubmit = command(
  'reasoning.submit',
  'Submit to reasoner',
  'Reasoning',
  (args: IntentPayload) =>
    void narsBackend.control?.submit({
      term: String((args as any).term ?? ''),
      mode: ((args as any).mode as 'belief' | 'goal' | 'question') ?? 'belief',
    }),
  {
    parse: (args: IntentPayload) => ({
      term: String((args as any).term ?? ''),
      mode: ((args as any).mode as 'belief' | 'goal' | 'question') ?? 'belief',
    }),
    available: () => reasoningAvailable() && caps().canSubmit,
    keywords: 'reasoning submit belief goal question nars',
  }
);

const reasoningStep = command(
  'reasoning.step',
  'Step reasoner',
  'Reasoning',
  () => {
    $runTerminations.set([]);
    void narsBackend.control
      ?.step()
      .then((result) => $runTerminations.set(result.termination ?? []));
  },
  {
    available: () => reasoningAvailable() && caps().canStep,
    keywords: 'reasoning step inference nars',
  }
);

const reasoningRun = command(
  'reasoning.run',
  'Run reasoner',
  'Reasoning',
  () => {
    $reasoningRunning.set(true);
    $runTerminations.set([]);
    void narsBackend.control
      ?.run()
      .then((result) => $runTerminations.set(result.termination ?? []))
      .finally(() => $reasoningRunning.set(false));
  },
  {
    available: () => reasoningAvailable() && caps().canRun,
    keywords: 'reasoning run inference nars',
  }
);

const reasoningRetract = command(
  'reasoning.retract',
  'Retract belief',
  'Reasoning',
  (args: IntentPayload) => void narsBackend.control?.retract(String((args as any).nodeId ?? '')),
  {
    parse: (args: IntentPayload) => ({ nodeId: String((args as any).nodeId ?? '') }),
    available: () => reasoningAvailable() && caps().canRetract,
    keywords: 'reasoning retract belief remove nars',
  }
);

const reasoningRevise = command(
  'reasoning.revise',
  'Revise belief',
  'Reasoning',
  (args: IntentPayload) =>
    void narsBackend.control?.revise(
      String((args as any).nodeId ?? ''),
      Number((args as any).frequency ?? 0),
      Number((args as any).confidence ?? 0)
    ),
  {
    parse: (args: IntentPayload) => ({
      nodeId: String((args as any).nodeId ?? ''),
      frequency: Number((args as any).frequency ?? 0),
      confidence: Number((args as any).confidence ?? 0),
    }),
    available: () => reasoningAvailable() && caps().canRevise,
    keywords: 'reasoning revise belief truth frequency confidence nars',
  }
);

const reasoningAddGoal = command(
  'reasoning.add-goal',
  'Add goal',
  'Reasoning',
  (args: IntentPayload) => void narsBackend.control?.addGoal(String((args as any).term ?? '')),
  {
    parse: (args: IntentPayload) => ({ term: String((args as any).term ?? '') }),
    available: () => reasoningAvailable() && caps().canAddGoal,
    keywords: 'reasoning add goal nars',
  }
);

const reasoningAdjustBudget = command(
  'reasoning.adjust-budget',
  'Adjust reasoning budget',
  'Reasoning',
  (args: IntentPayload) => void narsBackend.control?.adjustBudget(Number((args as any).budget ?? 0)),
  {
    parse: (args: IntentPayload) => ({ budget: Number((args as any).budget ?? 0) }),
    available: () => reasoningAvailable() && caps().canAdjustBudget,
    keywords: 'reasoning budget adjust nars',
  }
);

const reasoningAdjustProvider = command(
  'reasoning.adjust-provider',
  'Adjust LM provider for reasoning',
  'Reasoning',
  (args: IntentPayload) => void narsBackend.control?.adjustProvider(String((args as any).provider ?? '')),
  {
    parse: (args: IntentPayload) => ({ provider: String((args as any).provider ?? '') }),
    available: () => reasoningAvailable() && caps().canAdjustProvider,
    keywords: 'reasoning provider lm switch nars',
  }
);

const reasoningAbort = command(
  'reasoning.abort',
  'Abort reasoning run',
  'Reasoning',
  () => void narsBackend.control?.abort(),
  {
    available: () => reasoningAvailable() && caps().canAbort && $controlMode.get() && $reasoningRunning.get(),
    keywords: 'reasoning abort stop cancel nars',
  }
);

// Demo commands
const demoRunning = atom<boolean>(false);
const demoQueue = atom<Array<() => Promise<void>>>([]);

const DEMOS: Record<string, (() => Promise<void>)[]> = {
  'nars-intro': [
    async () => { dispatch('overlay.palette'); },
    async () => { await sleep(500); dispatch('graph:layout', 'chronological-flow'); },
    async () => { await sleep(500); dispatch('overlay:open', { id: 'toc' }); },
    async () => { await sleep(500); dispatch('overlay:open', { id: 'toc' }); },
    async () => { await sleep(500); dispatch('reasoning.run'); },
    async () => { await sleep(2000); dispatch('reasoning.abort'); },
  ],
  'graph-tour': [
    async () => { dispatch('overlay.palette'); },
    async () => { await sleep(500); dispatch('graph:layout', 'chronological-flow'); },
    async () => { await sleep(500); dispatch('graph:layout', 'semantic-map'); },
    async () => { await sleep(500); dispatch('graph:layout', 'artifact-map'); },
    async () => { await sleep(500); dispatch('graph:layout', 'source-view'); },
    async () => { await sleep(500); dispatch('graph:layout', 'cycle'); },
  ],
  'composer-modes': [
    async () => { dispatch('overlay.palette'); },
    async () => { await sleep(500); dispatch('composer.mode.chat'); },
    async () => { await sleep(500); dispatch('composer.mode.code'); },
    async () => { await sleep(500); dispatch('composer.mode.nal'); },
    async () => { await sleep(500); dispatch('composer.mode.reason'); },
  ],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playDemo(name: string): Promise<void> {
  const steps = DEMOS[name];
  if (!steps) {
    console.warn(`[demo] Unknown demo: ${name}`);
    return;
  }
  demoRunning.set(true);
  demoQueue.set([...steps]);
  await runDemoSteps();
}

function stopDemo(): void {
  demoRunning.set(false);
  demoQueue.set([]);
}

async function runDemoSteps(): Promise<void> {
  while (demoRunning.get() && demoQueue.get().length > 0) {
    const step = demoQueue.get().shift();
    if (step) {
      demoQueue.set([...demoQueue.get()]);
      try {
        await step();
      } catch (e) {
        console.error('[demo] Step failed:', e);
      }
    }
    await sleep(100);
  }
  demoRunning.set(false);
}

const demoPlay = command(
  'demo.play',
  'Play demonstration',
  'Demos',
  (args: IntentPayload) => playDemo(String((args as any).demo ?? '')),
  {
    parse: (args: IntentPayload) => ({ demo: String((args as any).demo ?? '') }),
    available: () => true,
    keywords: 'demo demonstration narrative sequence',
  }
);

const demoStop = command(
  'demo.stop',
  'Stop demonstration',
  'Demos',
  () => stopDemo(),
  {
    available: () => demoRunning.get(),
    keywords: 'demo demonstration stop cancel',
  }
);

const demoList = command(
  'demo.list',
  'List demonstrations',
  'Demos',
  () => eventBus.emit('overlay:open', { id: 'demo-list', ref: Object.keys(DEMOS).join(', ') }),
  {
    available: () => true,
    keywords: 'demo demonstration list available',
  }
);

// ===== Build the intent catalog =====

// Collect all static intents
const staticIntents: Record<string, IntentDescriptor> = {
  // Signals
  [graphSearch.id]: graphSearch,
  [graphLayout.id]: graphLayout,
  [graphPanTo.id]: graphPanTo,
  [graphZoomIn.id]: graphZoomIn,
  [graphZoomOut.id]: graphZoomOut,
  [graphFit.id]: graphFit,
  [graphMinimapToggle.id]: graphMinimapToggle,
  [graphLegendToggle.id]: graphLegendToggle,
  [overlayOpen.id]: overlayOpen,
  [overlayClose.id]: overlayClose,
  [overlayPin.id]: overlayPin,
  [overlayPinToggle.id]: overlayPinToggle,
  [overlayMinimize.id]: overlayMinimize,
  [overlayMaximize.id]: overlayMaximize,
  [overlayCascade.id]: overlayCascade,
  [overlayTile.id]: overlayTile,
  [composerFocus.id]: composerFocus,
  [composerOpen.id]: composerOpen,
  [composerMode.id]: composerMode,
  [composerPrefill.id]: composerPrefill,
  [testResetAll.id]: testResetAll,
  [testStep.id]: testStep,
  [viewFit.id]: viewFit,
  [appError.id]: appError,
  // Commands
  [viewFitCmd.id]: viewFitCmd,
  [viewMinimap.id]: viewMinimap,
  [overlayPinToggleCmd.id]: overlayPinToggleCmd,
  [viewFoldAll.id]: viewFoldAll,
  [overlayCascadeCmd.id]: overlayCascadeCmd,
  [overlayTileCmd.id]: overlayTileCmd,
  [controlModeToggle.id]: controlModeToggle,
  [composerPrefillCmd.id]: composerPrefillCmd,
  [reasoningSubmit.id]: reasoningSubmit,
  [reasoningStep.id]: reasoningStep,
  [reasoningRun.id]: reasoningRun,
  [reasoningRetract.id]: reasoningRetract,
  [reasoningRevise.id]: reasoningRevise,
  [reasoningAddGoal.id]: reasoningAddGoal,
  [reasoningAdjustBudget.id]: reasoningAdjustBudget,
  [reasoningAdjustProvider.id]: reasoningAdjustProvider,
  [reasoningAbort.id]: reasoningAbort,
  [demoPlay.id]: demoPlay,
  [demoStop.id]: demoStop,
  [demoList.id]: demoList,
};

// Dynamic intents added at runtime
let intentCatalog: IntentCatalog<string, IntentDescriptor> | null = null;

function buildCatalog(): IntentCatalog<string, IntentDescriptor> {
  const allIntents: Record<string, IntentDescriptor> = {
    ...staticIntents,
    ...Object.fromEntries(rendererCommands().map((i) => [i.id, i])),
    ...Object.fromEntries(overlayCommands().map((i) => [i.id, i])),
    ...Object.fromEntries(panelCommands.map((i) => [i.id, i])),
    ...Object.fromEntries(composerModeCommands().map((i) => [i.id, i])),
  };
  return defineIntentCatalog(allIntents);
}

export function getIntentCatalog(): IntentCatalog<string, IntentDescriptor> {
  if (!intentCatalog) {
    intentCatalog = buildCatalog();
  }
  return intentCatalog;
}

export function rebuildIntentCatalog(): void {
  intentCatalog = buildCatalog();
}

// ===== Unified dispatch (replaces dispatchCommand + eventBus.emit) =====

let _dispatch: ((id: string, args?: IntentPayload) => boolean) | null = null;

function getDispatch(): (id: string, args?: IntentPayload) => boolean {
  if (!_dispatch) {
    _dispatch = getIntentCatalog().dispatch;
  }
  return _dispatch;
}

export function dispatch(id: string, args?: IntentPayload): boolean {
  return getDispatch()(id, args);
}

// Back-compat: dispatchCommand delegates to the intent catalog
export const dispatchCommand = (id: string, args: Record<string, unknown> = {}): boolean => {
  return dispatch(id, args);
};

// Back-compat: activeCommands and paletteCommands
export const activeCommands = () =>
  getIntentCatalog().allIntents().filter((i) => i.available?.() !== false);

export const paletteCommands = () =>
  getIntentCatalog().paletteIntents();

// Re-export IntentDescriptor for back-compat
export type { IntentDescriptor } from '../framework/intent';

export { DEMOS, playDemo, stopDemo, demoRunning, demoQueue };