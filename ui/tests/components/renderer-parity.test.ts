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
import {
  declareParity,
  rendererHasControl,
  rendererParity,
  rendererParityFor,
  rendererSupports,
  workspaceRenderer,
  workspaceRenderers,
} from '../../src/client/core/workspace-renderer.js';

const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('expected a registered renderer');
  return value;
};

const fullRenderers = () => workspaceRenderers().filter((renderer) => renderer.capabilities().parity === 'full');

const sorted = (refs: readonly string[]): string[] => [...refs].sort();

describe('renderer parity (§10, Phase 2.5)', () => {
  afterEach(() => {
    setWorkspaceFocus(undefined);
    setWorkspaceSelection([]);
  });

  it('registers notebook, graph and a declared-partial graph3d', () => {
    const ids = workspaceRenderers().map((renderer) => renderer.id);
    expect(ids).toEqual(expect.arrayContaining(['notebook', 'graph', 'graph3d']));
    expect(graph3dRenderer.capabilities().parity).toBe('partial');
    for (const renderer of [notebookRenderer, graphRenderer]) {
      expect(renderer.capabilities().parity).toBe('full');
    }
  });

  it('exposes the §10 matrix as data for every registered renderer', () => {
    const rows = rendererParity();
    expect(rows.map((row) => row.id)).toEqual(workspaceRenderers().map((renderer) => renderer.id));
    for (const row of rows) {
      const caps = must(workspaceRenderer(row.id)).capabilities();
      const fromTable = must(rendererParityFor(row.id));
      expect(fromTable.parity).toBe(caps.parity);
      expect(sorted(fromTable.interactions as readonly string[])).toEqual(sorted(caps.interactions));
      expect(fromTable.rendererKind).toBe(caps.surface ?? row.id);
    }
  });

  it('gates interactions and controls from the parity table', () => {
    const notebook = must(workspaceRenderer('notebook'));
    const graph = must(workspaceRenderer('graph'));
    expect(rendererSupports(notebook, 'compose')).toBe(true);
    expect(rendererHasControl(graph, 'layers')).toBe(true);
    expect(rendererHasControl(notebook, 'layers')).toBe(false);

    const original = must(rendererParityFor('notebook')).interactions;
    declareParity('notebook', { interactions: [] });
    expect(rendererSupports(notebook, 'compose')).toBe(false);
    declareParity('notebook', { interactions: original });
    expect(rendererSupports(notebook, 'compose')).toBe(true);
  });

  it('runs the canonical focus/select/snapshot/restore loop per full renderer', () => {
    for (const renderer of fullRenderers()) {
      setWorkspaceFocus(undefined);
      setWorkspaceSelection([]);
      renderer.focus('blk-a');
      renderer.select(['blk-a', 'blk-b']);
      expect($workspaceGraph.get().focus).toBe('blk-a');
      expect(sorted($workspaceGraph.get().selection)).toEqual(['blk-a', 'blk-b']);

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

  it('round-trips focus/selection across every ordered pair of full renderers', () => {
    for (const from of fullRenderers()) {
      for (const to of fullRenderers()) {
        if (from === to) continue;
        from.focus('p1');
        from.select(['p1', 'p2']);
        to.restore(from.snapshot());
        expect(to.snapshot().focus).toBe('p1');
        expect(sorted(to.snapshot().selection)).toEqual(['p1', 'p2']);
        expect(sorted($selectedNodeIds.get())).toEqual(['p1', 'p2']);
      }
    }
  });
});
