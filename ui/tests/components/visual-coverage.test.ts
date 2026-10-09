import { describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/index.js';
import '../../src/client/components/renderers/graph.js';
import '../../src/client/components/renderers/graph3d.js';
import '../../src/client/components/renderers/notebook.js';
import '../../src/client/components/views/index.js';
import { CONVERSATION_LAYOUT_IDS } from '../../src/client/core/conversation-layout.js';
import { overlays } from '../../src/client/core/overlay-registry.js';
import { REASONING_LAYOUT_IDS } from '../../src/client/core/reasoning-layout.js';
import { $panels } from '../../src/client/core/store.js';
import { supportedShapes } from '../../src/client/core/view-adapter.js';
import { workspaceRendererIds } from '../../src/client/core/workspace-renderer.js';
import { VISUAL_CELLS } from '../visual/matrix.js';

/**
 * The §P1 coverage contract: every registered surface has a screenshot cell, or
 * an explicit gap. The ledger must shrink to empty as coverage lands — a newly
 * registered overlay/renderer/layout/shape with no cell turns this red.
 */
const KNOWN_GAPS = new Set(['renderer:graph3d']);

const requiredSurfaces = (): string[] => [
  ...overlays().map((overlay) => `overlay:${overlay.id}`),
  ...workspaceRendererIds().map((id) => `renderer:${id}`),
  ...[...CONVERSATION_LAYOUT_IDS, ...REASONING_LAYOUT_IDS].map((id) => `layout:${id}`),
  ...supportedShapes().map((shape) => `view:${shape}`),
  ...[...$panels.get().keys()].map((id) => `panel:${id}`),
];

describe('visual coverage', () => {
  it('has a screenshot cell for every registered surface, or a declared gap', () => {
    const covered = new Set(VISUAL_CELLS.map((cell) => cell.surface).filter(Boolean));
    const uncovered = requiredSurfaces().filter((key) => !covered.has(key) && !KNOWN_GAPS.has(key));
    expect(uncovered).toEqual([]);
  });

  it('carries no stale gap — every gap names a still-required, still-uncaptured surface', () => {
    const covered = new Set(VISUAL_CELLS.map((cell) => cell.surface).filter(Boolean));
    const required = new Set(requiredSurfaces());
    const stale = [...KNOWN_GAPS].filter((key) => !required.has(key) || covered.has(key));
    expect(stale).toEqual([]);
  });
});