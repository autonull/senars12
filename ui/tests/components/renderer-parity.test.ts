import { afterEach, describe, expect, it } from 'vitest';
import { graphRenderer } from '../../src/client/components/renderers/graph.js';
import { graph3dRenderer } from '../../src/client/components/renderers/graph3d.js';
import { notebookRenderer } from '../../src/client/components/renderers/notebook.js';
import {
  $selectedNodeIds,
  $workspaceGraph,
  setWorkspaceFocus,
  setWorkspaceSelection,
} from '../../src/client/core/store.js';
import { workspaceRenderers } from '../../src/client/core/workspace-renderer.js';

const fullRenderers = () => workspaceRenderers().filter((renderer) => renderer.capabilities().parity === 'full');

const sorted = (refs: readonly string[]): string[] => [...refs].sort();

describe('renderer parity (§10, Phase 2.5)', () => {
  afterEach(() => {
    setWorkspaceFocus(undefined);
    setWorkspaceSelection([]);
    $selectedNodeIds.set(new Set());
  });

  it('registers notebook, graph and a declared-partial graph3d', () => {
    const ids = workspaceRenderers().map((renderer) => renderer.id);
    expect(ids).toEqual(expect.arrayContaining(['notebook', 'graph', 'graph3d']));
    expect(graph3dRenderer.capabilities().parity).toBe('partial');
    for (const renderer of [notebookRenderer, graphRenderer]) {
      expect(renderer.capabilities().parity).toBe('full');
    }
  });

  it('keeps every full renderer on the shared session state', () => {
    for (const renderer of fullRenderers()) {
      renderer.focus('blk-a');
      renderer.select(['blk-a', 'blk-b']);
      expect($workspaceGraph.get().focus).toBe('blk-a');
      expect(sorted($workspaceGraph.get().selection)).toEqual(['blk-a', 'blk-b']);
    }
  });

  it('snapshots and restores focus/selection for every full renderer', () => {
    for (const renderer of fullRenderers()) {
      setWorkspaceFocus('blk-a');
      setWorkspaceSelection(['blk-a', 'blk-b']);
      const snap = renderer.snapshot();
      expect(snap.renderer).toBe(renderer.id);
      expect(snap.focus).toBe('blk-a');

      setWorkspaceFocus(undefined);
      setWorkspaceSelection([]);
      renderer.restore(snap);
      expect($workspaceGraph.get().focus).toBe('blk-a');
      expect(sorted($workspaceGraph.get().selection)).toEqual(['blk-a', 'blk-b']);
    }
  });

  it('round-trips a switch between Notebook and Graph', () => {
    notebookRenderer.focus('p1');
    notebookRenderer.select(['p1']);
    graphRenderer.restore(notebookRenderer.snapshot());
    expect(graphRenderer.snapshot().focus).toBe('p1');
    expect(sorted(graphRenderer.snapshot().selection)).toEqual(['p1']);
    expect(sorted($selectedNodeIds.get())).toEqual(['p1']);

    graphRenderer.focus('c1');
    notebookRenderer.restore(graphRenderer.snapshot());
    expect(notebookRenderer.snapshot().focus).toBe('c1');
    expect(sorted(notebookRenderer.snapshot().selection)).toEqual(['p1']);
  });
});
