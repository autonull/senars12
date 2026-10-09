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

/** One deterministic concept the engine-free fixtures render, so captures never drift. */
const STUB_NODE = {
  id: 'concept:stub',
  nodeType: 'nar:concept',
  label: '(robin-->bird)',
  term: '(robin-->bird)',
  priority: 0.5,
  confidence: 1,
} as const;

/** Replace engine state with one known concept and no events, before capture. */
const isolateGraph = (page: Page): Promise<void> =>
  page.evaluate((node) => {
    const api = (window as Record<string, unknown>).__testApi as {
      store?: { setState?: (path: string, value: unknown) => void };
    };
    api?.store?.setState?.('cognitiveEvents', []);
    api?.store?.setState?.('graphNodes', new Map([[node.id, node]]));
    api?.store?.setState?.('graphEdges', new Map());
  }, STUB_NODE);

/** One dataset per view shape, rendered through the real `<s-view>` host. */
const VIEW_FIXTURES: Record<string, unknown> = {
  graph: { kind: 'text', lines: ['(robin-->bird)'] },
  series: {
    kind: 'series',
    series: [
      { id: 'frequency', label: 'Frequency', values: [0.5, 0.7, 0.9] },
      { id: 'confidence', label: 'Confidence', values: [0.9, 0.85, 0.8] },
    ],
  },
  tree: {
    kind: 'tree',
    roots: [
      {
        id: 'root',
        label: '(robin-->animal)',
        children: [
          { id: 'p1', label: '(robin-->bird)' },
          { id: 'p2', label: '(bird-->animal)' },
        ],
      },
    ],
  },
  text: {
    kind: 'text',
    lines: ['robin is a bird,', 'bird is an animal,', 'therefore robin is an animal.'],
  },
  code: {
    kind: 'code',
    language: 'narsese',
    lines: ['<robin --> bird>.', '<bird --> animal>.', '<robin --> animal>?'],
  },
  diff: {
    kind: 'diff',
    from: 'revision 1',
    to: 'revision 2',
    lines: [
      { kind: 'context', text: '<robin --> bird>.' },
      { kind: 'del', text: '<swan --> white>. [f=1.00, c=0.90]' },
      { kind: 'add', text: '<swan --> white>. [f=0.90, c=0.70]' },
    ],
  },
};

/**
 * Mount a real `<s-view>` over the shell with one shape + dataset. The view
 * system's only entry point is the host element, so a shape is best captured by
 * giving it the host and a source — no bespoke rendering path exists to cover.
 */
const mountView =
  (shape: string): VisualCell['prepare'] =>
  async ({ page }) => {
    await page.evaluate(
      ([activeShape, dataset]) => {
        const frame = document.createElement('section');
        frame.setAttribute('data-view-fixture', activeShape);
        frame.style.cssText =
          'position:fixed;inset:3.5rem 1.5rem 5.5rem 1.5rem;z-index:100000;' +
          'background:var(--colors-semantic-bg-base);' +
          'border:1px solid var(--colors-semantic-border-subtle);';
        const host = document.createElement('s-view') as HTMLElement & {
          spec?: unknown;
          budget?: string;
          chrome?: boolean;
        };
        host.spec = {
          id: 'view-fixture',
          title: `${activeShape} view`,
          shapes: [activeShape],
          source: { get: () => dataset },
        };
        host.budget = 'full';
        host.chrome = true;
        host.setAttribute('style', 'height:100%');
        frame.append(host);
        document.body.append(frame);
      },
      [shape, VIEW_FIXTURES[shape]] as const
    );
    await page.waitForTimeout(400);
  };

/** Drive the shell into a connection state through the real store. */
const setConnection =
  (state: string): VisualCell['prepare'] =>
  async ({ page }) => {
    await page.evaluate((next) => {
      (
        (window as Record<string, unknown>).__testApi as {
          store?: { setState?: (path: string, value: unknown) => void };
        }
      )?.store?.setState?.('connectionState', next);
    }, state);
    await page.waitForTimeout(250);
  };

/** Clear every workspace source so the shell shows its empty state. */
const emptyShell: VisualCell['prepare'] = async ({ page }) => {
  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as {
      store?: { setState?: (path: string, value: unknown) => void };
    };
    api?.store?.setState?.('graphNodes', new Map());
    api?.store?.setState?.('graphEdges', new Map());
    api?.store?.setState?.('cognitiveEvents', []);
    api?.store?.setState?.('chatMessages', []);
  });
  await page.waitForTimeout(400);
};

/** Surface the error boundary through its real `app-error` event. */
const raiseAppError: VisualCell['prepare'] = async ({ page }) => {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('app-error', {
        detail: {
          message: 'Projection worker failed to reduce the derivation graph',
          detail: 'Error: reduce() of undefined\n    at projectDerivations (workspace-projection.ts)',
        },
      })
    );
  });
  await page.waitForTimeout(300);
};

/**
 * Apply a fixture, let the server's 2s derivation-recorder tick fire, then apply
 * it again so the capture lands in the quiet window before the next tick — the
 * same discipline `seedConversation` uses; otherwise late records drift the frame.
 */
const inQuietWindow = async (
  page: Page,
  settle: VisualContext['settle'],
  apply: () => Promise<void>
): Promise<void> => {
  await apply();
  await page.waitForTimeout(2200);
  await apply();
  await settle();
};

/** Seed the MeTTa substrate (atoms/skills + rewrite edges) the engine would emit. */
const seedMetta: VisualCell['prepare'] = ({ page, settle }) =>
  inQuietWindow(page, settle, () =>
    page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as {
        store?: { setState?: (path: string, value: unknown) => void };
      };
      api?.store?.setState?.('cognitiveEvents', []);
      api?.store?.setState?.('chatMessages', []);
      api?.store?.setState?.(
        'graphNodes',
        new Map([
          [
            'metta:atom:animal',
            { id: 'metta:atom:animal', nodeType: 'metta:atom', label: '(animal $x)', atom: '(animal $x)', confidence: 0.9 },
          ],
          [
            'metta:atom:robin',
            { id: 'metta:atom:robin', nodeType: 'metta:atom', label: '(robin)', atom: '(robin)', confidence: 0.95 },
          ],
          [
            'metta:skill:match',
            { id: 'metta:skill:match', nodeType: 'metta:skill', label: 'match', skill: 'match', confidence: 1 },
          ],
        ])
      );
      api?.store?.setState?.(
        'graphEdges',
        new Map([
          [
            'metta:edge:1',
            { id: 'metta:edge:1', source: 'metta:atom:robin', target: 'metta:atom:animal', type: 'metta:pattern-match', confidence: 0.9 },
          ],
          [
            'metta:edge:2',
            { id: 'metta:edge:2', source: 'metta:skill:match', target: 'metta:atom:animal', type: 'metta:skill-execution' },
          ],
        ])
      );
    })
  );

/** Seed the budget/gate cognitive events the projection turns into blocks. */
const seedGates: VisualCell['prepare'] = ({ page, settle }) =>
  inQuietWindow(page, settle, async () => {
    await isolateGraph(page);
    await page.evaluate(() => {
      const api = (window as Record<string, unknown>).__testApi as {
        store?: { setState?: (path: string, value: unknown) => void };
      };
      const t = 1_700_000_000_000;
      api?.store?.setState?.('cognitiveEvents', [
        {
          type: 'budget.exhausted',
          timestamp: t,
          correlationId: 'budget-1',
          payload: { budgetType: 'inference', remaining: 0, limit: 1000, terminationReason: 'exhausted' },
        },
        {
          type: 'egress.gate.rejected',
          timestamp: t + 1,
          correlationId: 'gate-1',
          payload: { gate: 'answer-quality', score: 0.42, detail: 'below threshold' },
        },
        {
          type: 'policy.violation',
          timestamp: t + 2,
          correlationId: 'policy-1',
          payload: { policyId: 'safety', violationType: 'unsafe-content', severity: 'high', detail: 'blocked' },
        },
      ]);
    });
  });

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

const CHAT_BASE = 1_700_000_000_000;

type SeedTurn = { id: string; role: 'user' | 'agent'; content: string };

/**
 * A conversation that exercises every conversation-layout substrate: ordered
 * turns, `responds-to` discourse, headings, a Markdown table (a `table` block
 * with payload) and a fenced code block. Seeded through the real chat store, so
 * the workspace projection builds the blocks the layouts arrange.
 */
const CHAT_TURNS: readonly SeedTurn[] = [
  { id: 'turn-1', role: 'user', content: 'What follows about robins from the taxonomy?' },
  {
    id: 'turn-2',
    role: 'agent',
    content:
      '## Derivation\n\nA robin is a bird; a bird is an animal, so a robin is an animal.\n\n| Premise | Relation |\n| --- | --- |\n| robin | bird |\n| bird | animal |\n\n```narsese\n<robin --> animal>.\n```',
  },
  { id: 'turn-3', role: 'user', content: 'And what does the swan colour evidence show?' },
  {
    id: 'turn-4',
    role: 'agent',
    content:
      '### Conflicting evidence\n\nTwo beliefs compete for the swan:\n\n- swan is white\n- swan is black\n\nRevision weighs the two by confidence.',
  },
];

/** Chat messages shaped for `$chatMessages`, with deterministic ids and order. */
const chatMessages = (turns: readonly SeedTurn[]) => {
  let lastUser = '';
  return turns.map((turn, index) => {
    const threadRoot = turn.role === 'user' ? turn.id : lastUser || turn.id;
    if (turn.role === 'user') lastUser = turn.id;
    return {
      id: turn.id,
      role: turn.role,
      content: turn.content,
      timestamp: CHAT_BASE + index * 1000,
      parentId: null,
      threadRootId: threadRoot,
      supports: [],
      contradicts: [],
      derivesFrom: [],
    };
  });
};

/**
 * Seed the conversation through the real `$chatMessages` store, then re-settle
 * so the workspace projection's new blocks are laid out before capture.
 *
 * The engine graph is isolated first (see `isolateGraph`): conversation layouts
 * arrange the conversation, so leaving the reasoning layer in would swamp the
 * frame. The server drains derivation records on a 2s timer that outlives
 * `pause()`, so after one interval we isolate again and capture in the quiet
 * window before the next tick — otherwise those records drift the frame.
 */
const seedConversation =
  (layout?: string, isolate = true): VisualCell['prepare'] =>
  async ({ page, settle }) => {
    if (isolate) await isolateGraph(page);
    await page.evaluate((messages) => {
      const api = (window as Record<string, unknown>).__testApi as {
        store?: { setState?: (path: string, value: unknown) => void };
      };
      api?.store?.setState?.('chatMessages', messages);
    }, chatMessages(CHAT_TURNS));
    await settle(layout);
    if (isolate) {
      await page.waitForTimeout(2200);
      await isolateGraph(page);
      await settle(layout);
    }
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

  // Conversation layouts (§5.3) — arrange the seeded conversation; concept
  // layouts (§3.4) — arrange the reasoning structure. Every registered layout
  // has a cell (visual-coverage contract).
  {
    id: 'layout-chronological-flow',
    group: 'Layouts',
    title: 'Conversation — chronological flow',
    surface: 'layout:chronological-flow',
    hash: '#panels=none&scope=conversation&layout=chronological-flow',
    layout: 'chronological-flow',
    prepare: seedConversation('chronological-flow'),
  },
  {
    id: 'layout-semantic-map',
    group: 'Layouts',
    title: 'Conversation — semantic map',
    surface: 'layout:semantic-map',
    hash: '#panels=none&scope=conversation&layout=semantic-map',
    layout: 'semantic-map',
    prepare: seedConversation('semantic-map'),
  },
  {
    id: 'layout-artifact-map',
    group: 'Layouts',
    title: 'Conversation — artifact map',
    surface: 'layout:artifact-map',
    hash: '#panels=none&scope=conversation&layout=artifact-map',
    layout: 'artifact-map',
    prepare: seedConversation('artifact-map'),
  },
  {
    id: 'layout-source-view',
    group: 'Layouts',
    title: 'Conversation — source view',
    surface: 'layout:source-view',
    hash: '#panels=none&scope=conversation&layout=source-view',
    layout: 'source-view',
    prepare: seedConversation('source-view'),
  },
  {
    id: 'layout-reasoning-provenance',
    group: 'Layouts',
    title: 'Reasoning — provenance',
    surface: 'layout:reasoning-provenance',
    scenario: 'basic-derivation',
    hash: '#panels=none&layout=reasoning-provenance',
    layout: 'reasoning-provenance',
  },
  {
    id: 'layout-gate-pipeline',
    group: 'Layouts',
    title: 'Reasoning — gate pipeline',
    surface: 'layout:gate-pipeline',
    scenario: 'basic-derivation',
    hash: '#panels=none&layout=gate-pipeline',
    layout: 'gate-pipeline',
  },
  {
    id: 'layout-contradiction-neighborhood',
    group: 'Layouts',
    title: 'Reasoning — contradiction neighborhood',
    surface: 'layout:contradiction-neighborhood',
    scenario: 'conflicting-evidence',
    hash: '#panels=none&lens=contradiction&layout=contradiction-neighborhood',
    layout: 'contradiction-neighborhood',
  },
  {
    id: 'layout-budget-resource',
    group: 'Layouts',
    title: 'Reasoning — budget/resource lanes',
    surface: 'layout:budget-resource',
    scenario: 'basic-derivation',
    hash: '#panels=none&layout=budget-resource',
    layout: 'budget-resource',
  },

  // Views (§3.3) — each registered view shape through the one `<s-view>` host.
  {
    id: 'view-graph',
    group: 'Views',
    title: 'View — graph',
    surface: 'view:graph',
    hash: '#panels=none',
    prepare: mountView('graph'),
  },
  {
    id: 'view-series',
    group: 'Views',
    title: 'View — series',
    surface: 'view:series',
    hash: '#panels=none',
    prepare: mountView('series'),
  },
  {
    id: 'view-tree',
    group: 'Views',
    title: 'View — tree',
    surface: 'view:tree',
    hash: '#panels=none',
    prepare: mountView('tree'),
  },
  {
    id: 'view-text',
    group: 'Views',
    title: 'View — text',
    surface: 'view:text',
    hash: '#panels=none',
    prepare: mountView('text'),
  },
  {
    id: 'view-code',
    group: 'Views',
    title: 'View — code',
    surface: 'view:code',
    hash: '#panels=none',
    prepare: mountView('code'),
  },
  {
    id: 'view-diff',
    group: 'Views',
    title: 'View — diff',
    surface: 'view:diff',
    hash: '#panels=none',
    prepare: mountView('diff'),
  },

  // Scenarios (§P1.3) — canonical engine states with committed baselines.
  {
    id: 'scenario-metta',
    group: 'Scenarios',
    title: 'Scenario — MeTTa substrate',
    hash: '#panels=none&renderer=notebook',
    prepare: seedMetta,
  },
  {
    id: 'scenario-budget-gate',
    group: 'Scenarios',
    title: 'Scenario — budget & gate decisions',
    hash: '#panels=none&renderer=notebook',
    prepare: seedGates,
  },

  // States (§P1.4) — the shell rendered in each reachable non-happy state.
  {
    id: 'state-empty',
    group: 'States',
    title: 'State — empty workspace',
    hash: '#panels=none',
    prepare: emptyShell,
  },
  {
    id: 'state-loading',
    group: 'States',
    title: 'State — connecting',
    hash: '#panels=none',
    prepare: setConnection('connecting'),
  },
  {
    id: 'state-disconnected',
    group: 'States',
    title: 'State — disconnected',
    hash: '#panels=none',
    prepare: setConnection('disconnected'),
  },
  {
    id: 'state-reconnecting',
    group: 'States',
    title: 'State — reconnecting',
    hash: '#panels=none',
    prepare: setConnection('reconnecting'),
  },
  {
    id: 'state-error-boundary',
    group: 'States',
    title: 'State — error boundary',
    hash: '#panels=none',
    prepare: raiseAppError,
  },
  {
    id: 'state-wide',
    group: 'States',
    title: 'State — wide viewport (1920×1080)',
    scenario: 'basic-derivation',
    hash: '#panels=none',
    viewport: { width: 1920, height: 1080 },
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
    prepare: seedConversation(undefined, false),
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
    prepare: async ({ page, settle }) => {
      await isolateGraph(page);
      // Let the derivation-recorder timer fire, then isolate into the quiet
      // window so a late record cannot repopulate the graph mid-capture.
      await page.waitForTimeout(2200);
      await isolateGraph(page);
      await settle();
      await page.evaluate((nodeId) => {
        (
          (window as Record<string, unknown>).__testApi as {
            graph?: { clickNode?: (i: string) => void };
          }
        )?.graph?.clickNode?.(nodeId);
      }, STUB_NODE.id);
      await page.waitForTimeout(400);
    },
  },
];