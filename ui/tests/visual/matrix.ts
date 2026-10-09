import type { Page } from '@playwright/test';
import type { TestControl } from '../framework/utils/test-control.js';

export type VisualContext = {
  page: Page;
  control: TestControl;
  /** Force a deterministic graph layout and let it settle. */
  settle: (layout?: string) => Promise<void>;
};

export type VisualCell = {
  /** Stable flat handle; also the snapshot file name and gallery anchor. */
  id: string;
  /** Contact-sheet section. */
  group: string;
  title: string;
  /** The §P1 coverage key this cell satisfies: `overlay:<id>` | `renderer:<id>` | … */
  surface?: string;
  /** Scenario loaded through the real engine before the page boots. */
  scenario?: string;
  /** URL hash applied through the real boot-hydration path. */
  hash?: string;
  viewport?: { width: number; height: number };
  /** Deterministic layout forced after data arrives (defaults to breadthfirst). */
  layout?: string;
  /** Mask these selectors to exclude volatile regions (e.g. live counters). */
  mask?: string[];
  /** Extra, cell-specific preparation. */
  prepare?: (ctx: VisualContext) => Promise<void>;
};

const NARROW = { width: 640, height: 900 } as const;

/** Open a registered overlay through the shell's own test seam. */
const openOverlay = (id: string): VisualCell['prepare'] => async ({ page }) => {
  await page.evaluate((overlayId) => {
    (
      (window as Record<string, unknown>).__testApi as { overlays?: { open?: (id: string) => void } }
    ).overlays?.open?.(overlayId);
  }, id);
  await page.waitForTimeout(300);
};

/**
 * The curated visual matrix. Cells are data: the spec renders each through the
 * real boot path, `surface` keys the §P1 coverage contract (see
 * `visual-coverage.test.ts`), and layouts are forced deterministic because
 * cytoscape `cose` seeds positions from `Math.random`.
 */
export const VISUAL_CELLS: VisualCell[] = [
  // Renderers — one per registered WorkspaceRenderer.
  {
    id: 'graph-belief-bootstrap',
    group: 'Renderers',
    title: 'Graph renderer — bootstrap',
    surface: 'renderer:graph',
    hash: '#panels=none',
  },
  {
    id: 'renderer-notebook-bootstrap',
    group: 'Renderers',
    title: 'Notebook renderer — bootstrap',
    surface: 'renderer:notebook',
    hash: '#panels=none&renderer=notebook',
  },

  // Graph states and lenses.
  {
    id: 'graph-belief-derivation',
    group: 'Graph',
    title: 'Belief lens — transitive derivation',
    scenario: 'basic-derivation',
    hash: '#panels=none',
  },
  {
    id: 'graph-table',
    group: 'Graph',
    title: 'Graph as table — concepts',
    scenario: 'basic-derivation',
    surface: 'view:table',
    hash: '#panels=none',
    prepare: async ({ page }) => {
      await page.evaluate(() => {
        (
          (window as Record<string, unknown>).__testApi as {
            store?: { setState?: (path: string, value: unknown) => void };
          }
        )?.store?.setState?.('graphShape', 'table');
      });
      await page.waitForTimeout(200);
    },
  },
  {
    id: 'graph-goal-lens',
    group: 'Lenses',
    title: 'Goal lens — concentric by priority',
    hash: '#panels=none&lens=goal',
    layout: 'concentric',
  },
  {
    id: 'graph-conflict-lens',
    group: 'Lenses',
    title: 'Conflict lens — competing evidence',
    scenario: 'conflicting-evidence',
    hash: '#panels=none&lens=contradiction',
    layout: 'breadthfirst',
  },

  // Responsive.
  {
    id: 'graph-narrow',
    group: 'Responsive',
    title: 'Narrow viewport — single column',
    hash: '#panels=none',
    viewport: NARROW,
  },

  // Overlays — one per registered overlay surface.
  {
    id: 'overlay-settings',
    group: 'Overlays',
    title: 'Settings overlay',
    surface: 'overlay:settings',
    hash: '#panels=none',
    prepare: openOverlay('settings'),
  },
  {
    id: 'overlay-palette',
    group: 'Overlays',
    title: 'Command palette',
    surface: 'overlay:palette',
    hash: '#panels=none',
    prepare: openOverlay('palette'),
  },
  {
    id: 'overlay-telemetry',
    group: 'Overlays',
    title: 'Telemetry overlay',
    surface: 'overlay:telemetry',
    hash: '#panels=none',
    prepare: openOverlay('telemetry'),
  },
  {
    id: 'overlay-timeline',
    group: 'Overlays',
    title: 'Timeline overlay',
    surface: 'overlay:timeline',
    hash: '#panels=none',
    prepare: openOverlay('timeline'),
  },
  {
    id: 'overlay-toc',
    group: 'Overlays',
    title: 'Table of contents overlay',
    surface: 'overlay:toc',
    hash: '#panels=none',
    prepare: openOverlay('toc'),
  },
  {
    id: 'overlay-provider',
    group: 'Overlays',
    title: 'Provider overlay',
    surface: 'overlay:provider',
    hash: '#panels=none',
    prepare: openOverlay('provider'),
  },

  // Panels.
  {
    id: 'panel-lens-designer',
    group: 'Panels',
    title: 'Lens designer',
    surface: 'panel:lens-designer',
    hash: '#panels=lens-designer',
  },
  {
    id: 'panel-chat',
    group: 'Panels',
    title: 'Chat history',
    surface: 'panel:chat',
    hash: '#panels=chat',
  },
  {
    id: 'panel-search',
    group: 'Panels',
    title: 'Search panel',
    surface: 'panel:search',
    hash: '#panels=search',
  },

  // Selection.
  {
    id: 'selection-node-detail',
    group: 'Selection',
    title: 'Node detail drawer',
    hash: '#panels=none',
    prepare: async ({ page }) => {
      const id = await page.evaluate(
        () =>
          (
            (window as Record<string, unknown>).__testApi as {
              graph?: { getAllNodeIds?: () => string[] };
            }
          )?.graph?.getAllNodeIds?.()[0] ?? null
      );
      if (!id) throw new Error('no graph nodes to select');
      await page.evaluate((nodeId) => {
        (
          (window as Record<string, unknown>).__testApi as {
            graph?: { clickNode?: (i: string) => void };
          }
        )?.graph?.clickNode?.(nodeId);
      }, id);
      await page.waitForTimeout(400);
    },
  },
];