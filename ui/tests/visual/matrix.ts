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

/** Kinds whose block carries a typed artifact, so the artifact viewer has content. */
const ARTIFACT_KINDS = [
  'derivation',
  'table',
  'code',
  'math',
  'chart',
  'image',
  'diagram',
  'tool-result',
] as const;

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
 * Resolve the first workspace block ref, preferring the given kinds, so overlays
 * that require a `Ref` (explain/artifact/related/block-menu) render real content.
 */
const resolveBlockRef = async (page: Page, prefer: readonly string[] = []): Promise<string> => {
  const ref = await page.evaluate((kinds) => {
    const graph = (
      (window as Record<string, unknown>).__testApi as {
        store?: {
          getState?: (path: string) => { blocks?: Map<string, { id: string; kind: string }> };
        };
      }
    )?.store?.getState?.('workspaceGraph');
    const blocks = graph?.blocks ? [...graph.blocks.values()] : [];
    const preferred = kinds.length ? blocks.find((block) => kinds.includes(block.kind)) : undefined;
    return (preferred ?? blocks[0])?.id ?? null;
  }, [...prefer]);
  if (!ref) throw new Error('no workspace block to reference');
  return ref;
};

/** Open a ref-bearing overlay through the shell test seam, with a real block. */
const openOverlayWithRef =
  (id: string, prefer?: readonly string[]): VisualCell['prepare'] =>
  async ({ page }) => {
    const ref = await resolveBlockRef(page, prefer);
    await page.evaluate(
      ([overlayId, blockRef]) => {
        (
          (window as Record<string, unknown>).__testApi as {
            overlays?: { open?: (id: string, ref?: string) => void };
          }
        ).overlays?.open?.(overlayId, blockRef);
      },
      [id, ref] as const
    );
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
  {
    id: 'overlay-explain',
    group: 'Overlays',
    title: 'Explanation overlay — block with links',
    surface: 'overlay:explain',
    scenario: 'basic-derivation',
    hash: '#panels=none',
    prepare: openOverlayWithRef('explain', ['derivation', 'claim']),
  },
  {
    id: 'overlay-artifact',
    group: 'Overlays',
    title: 'Artifact viewer — typed output',
    surface: 'overlay:artifact',
    scenario: 'basic-derivation',
    hash: '#panels=none',
    prepare: openOverlayWithRef('artifact', ARTIFACT_KINDS),
  },
  {
    id: 'overlay-related',
    group: 'Overlays',
    title: 'Related blocks — neighborhood',
    surface: 'overlay:related',
    scenario: 'basic-derivation',
    hash: '#panels=none',
    prepare: openOverlayWithRef('related', ['derivation', 'claim']),
  },
  {
    id: 'overlay-block-menu',
    group: 'Overlays',
    title: 'Block menu — node actions',
    surface: 'overlay:block-menu',
    scenario: 'basic-derivation',
    hash: '#panels=none',
    prepare: openOverlayWithRef('block-menu', ['derivation', 'claim']),
  },
  {
    id: 'overlay-tool-approval',
    group: 'Overlays',
    title: 'Tool approval — pending prompt',
    surface: 'overlay:tool-approval',
    hash: '#panels=none',
    prepare: async ({ page }) => {
      await page.evaluate(() => {
        (
          (window as Record<string, unknown>).__testApi as {
            overlays?: { open?: (id: string) => void };
          }
        )?.overlays?.open?.('tool-approval');
      });
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        (
          (window as Record<string, unknown>).__testApi as {
            toolApproval?: { request?: (args: Record<string, unknown>) => void };
          }
        )?.toolApproval?.request?.({
          promptType: 'confirm',
          title: 'Approve deployment',
          message: 'Deploy the revised belief set to the live knowledge base?',
        });
      });
      await page.waitForTimeout(400);
    },
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
    title: 'Node detail drawer — inspector follows selection',
    surface: 'overlay:inspector',
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