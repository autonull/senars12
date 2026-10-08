import { describe, expect, it } from 'vitest';
import '../../src/client/components/renderers/graph3d.js';
import type { BlockKind } from '../../src/client/core/workspace-graph.js';
import {
  registerRenderer,
  rendererSupports,
  renderersForKind,
  WORKSPACE_INTERACTIONS,
  workspaceRenderer,
  workspaceRendererIds,
  type WorkspaceRenderer,
} from '../../src/client/core/workspace-renderer.js';

const fakeRenderer = (
  id: string,
  blockKinds: readonly BlockKind[] | 'all'
): WorkspaceRenderer => ({
  id,
  label: id,
  capabilities: () => ({ interactions: ['compose', 'explain'], blockKinds, parity: 'full' }),
  mount: () => {},
  present: () => {},
  apply: () => {},
  focus: () => {},
  select: () => {},
  openComposer: () => {},
  openExplain: () => {},
  snapshot: () => ({ renderer: id, selection: [] }),
  restore: () => {},
  dispose: () => {},
});

const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('expected a registered renderer');
  return value;
};

describe('workspace renderer registry', () => {
  it('registers renderers and exposes them in order', () => {
    registerRenderer(fakeRenderer('notebook', 'all'));
    registerRenderer(fakeRenderer('graph', ['claim', 'derivation']));
    expect(workspaceRendererIds()).toEqual(expect.arrayContaining(['notebook', 'graph', 'graph3d']));
    expect(workspaceRenderer('notebook')?.label).toBe('notebook');
    expect(workspaceRenderer('missing')).toBeUndefined();
  });

  it('selects renderers that present a block kind richly', () => {
    const claimRenderers = renderersForKind('claim').map((r) => r.id);
    expect(claimRenderers).toContain('notebook');
    expect(claimRenderers).toContain('graph');
    const chartRenderers = renderersForKind('chart').map((r) => r.id);
    expect(chartRenderers).toContain('notebook');
    expect(chartRenderers).not.toContain('graph');
  });

  it('reports interaction support from capabilities', () => {
    const notebook = must(workspaceRenderer('notebook'));
    expect(rendererSupports(notebook, 'compose')).toBe(true);
    expect(rendererSupports(notebook, 'palette')).toBe(false);
  });

  it('registers graph3d as an honest partial renderer with round-trip state', () => {
    const graph3d = must(workspaceRenderer('graph3d'));
    expect(graph3d.capabilities().parity).toBe('partial');
    expect(graph3d.capabilities().blockKinds).toBe('all');
    graph3d.focus('ref-1');
    graph3d.select(['ref-1', 'ref-2']);
    const snap = graph3d.snapshot();
    expect(snap).toMatchObject({ renderer: 'graph3d', focus: 'ref-1' });
    expect(snap.selection).toEqual(['ref-1', 'ref-2']);
    graph3d.restore({ renderer: 'graph3d', selection: [] });
    expect(graph3d.snapshot().focus).toBeUndefined();
  });

  it('declares the full interaction vocabulary', () => {
    expect(WORKSPACE_INTERACTIONS).toContain('embed');
    expect(WORKSPACE_INTERACTIONS).toHaveLength(12);
  });
});
