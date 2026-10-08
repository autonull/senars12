import { afterEach, describe, expect, it } from 'vitest';
import {
  $activeRenderer,
  $collapsedBlocks,
  $urlState,
  $workspaceGraph,
  hydrateFromUrl,
  toggleCollapsed,
} from '../../src/client/core/store.js';
import { emptyWorkspaceGraph } from '../../src/client/core/workspace-graph.js';

const clearHash = () => window.history.replaceState(null, '', window.location.pathname);

afterEach(() => {
  clearHash();
  $activeRenderer.set('graph');
  $workspaceGraph.set(emptyWorkspaceGraph());
  $collapsedBlocks.set(new Set());
  $urlState.set({ lens: 'belief' });
});

describe('url-addressable state', () => {
  it('hydrates the active renderer and focus from the hash', () => {
    window.location.hash = 'renderer=notebook&focus=blk1';
    hydrateFromUrl();
    expect($activeRenderer.get()).toBe('notebook');
    expect($workspaceGraph.get().focus).toBe('blk1');
  });

  it('mirrors renderer and focus changes into the url state', () => {
    $activeRenderer.set('graph');
    $workspaceGraph.set({ ...$workspaceGraph.get(), focus: 'blk2' });
    expect($urlState.get()).toEqual(expect.objectContaining({ renderer: 'graph', focus: 'blk2' }));
  });

  it('hydrates and mirrors folded blocks (disclosure)', () => {
    window.location.hash = 'folded=a,b';
    hydrateFromUrl();
    expect([...$collapsedBlocks.get()].sort()).toEqual(['a', 'b']);

    toggleCollapsed('c');
    expect($urlState.get().folded).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('re-hydrates on a hashchange (back/forward or pasted link)', () => {
    window.location.hash = 'renderer=notebook&focus=blk9';
    window.dispatchEvent(new Event('hashchange'));
    expect($activeRenderer.get()).toBe('notebook');
    expect($workspaceGraph.get().focus).toBe('blk9');
  });
});
