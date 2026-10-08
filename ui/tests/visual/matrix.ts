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

/**
 * The curated visual matrix. Cells are data: the spec renders each through the
 * real boot path, `defineSurface`-derived cells (Phase 3) will append here.
 * Layouts are forced deterministic because cytoscape `cose` seeds positions from
 * `Math.random`; pixel-stable baselines need a topology-derived layout.
 */
export const VISUAL_CELLS: VisualCell[] = [
  {
    id: 'graph-belief-bootstrap',
    group: 'Graph',
    title: 'Belief lens — bootstrap taxonomy',
    hash: '#panels=none',
  },
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
  {
    id: 'graph-narrow',
    group: 'Responsive',
    title: 'Narrow viewport — single column',
    hash: '#panels=none',
    viewport: NARROW,
  },
  {
    id: 'panel-config',
    group: 'Panels',
    title: 'Configuration panel',
    hash: '#panels=config',
  },
  {
    id: 'panel-lens-designer',
    group: 'Panels',
    title: 'Lens designer',
    hash: '#panels=lens-designer',
  },
  {
    id: 'panel-chat',
    group: 'Panels',
    title: 'Chat history',
    hash: '#panels=chat',
  },
  {
    id: 'panel-search',
    group: 'Panels',
    title: 'Search panel',
    hash: '#panels=search',
  },
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
