import { afterEach, describe, expect, it } from 'vitest';
import {
  $activeLens,
  $activeRenderer,
  $collapsedBlocks,
  $conversationLayout,
  $graphLayer,
  $layoutScope,
  $lensLayer,
  $lensLayout,
  $panels,
  $urlState,
  $workspaceGraph,
  hydrateFromUrl,
  setActiveLayout,
  setGraphLayer,
  toggleCollapsed,
} from '../../src/client/core/store.js';
import { emptyWorkspaceGraph } from '../../src/client/core/workspace-graph.js';
import {
  registerRenderer,
  type WorkspaceRenderer,
} from '../../src/client/core/workspace-renderer.js';
import '../../src/client/utils/layout-registry.js';

const fakeRenderer = (id: string): WorkspaceRenderer => ({
  id,
  label: id,
  capabilities: () => ({ interactions: [], blockKinds: 'all', parity: 'full' }),
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

registerRenderer(fakeRenderer('notebook'));

const clearHash = () => window.history.replaceState(null, '', window.location.pathname);
const setPanels = (open: (id: string) => boolean) =>
  $panels.set(new Map([...$panels.get()].map(([id, panel]) => [id, { ...panel, open: open(id) }])));

afterEach(() => {
  clearHash();
  $activeRenderer.set('graph');
  $workspaceGraph.set(emptyWorkspaceGraph());
  $collapsedBlocks.set(new Set());
  $lensLayer.set({});
  $graphLayer.set('both');
  $activeLens.set('belief');
  $layoutScope.set('concept');
  $conversationLayout.set('chronological-flow');
  $lensLayout.set({ belief: 'cose' });
  setPanels(() => false);
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

  it('hydrates and mirrors the graph layer', () => {
    window.location.hash = 'layer=conversation';
    hydrateFromUrl();
    expect($graphLayer.get()).toBe('conversation');
    setGraphLayer('concepts');
    expect($urlState.get().layer).toBe('concepts');
  });

  it('hydrates and mirrors the active graph layout', () => {
    window.location.hash = 'layout=breadthfirst';
    hydrateFromUrl();
    expect($lensLayout.get().belief).toBe('breadthfirst');
    expect($urlState.get().layout).toBe('breadthfirst');

    $lensLayout.set({ belief: 'cose' });
    expect($urlState.get().layout).toBeUndefined();
  });

  it('URL-addresses the layout scope alongside the layout', () => {
    window.location.hash = 'scope=conversation&layout=chronological-flow';
    hydrateFromUrl();
    expect($layoutScope.get()).toBe('conversation');
    expect($conversationLayout.get()).toBe('chronological-flow');
    expect($urlState.get().scope).toBe('conversation');
    expect($urlState.get().layout).toBe('chronological-flow');
  });

  it('routes a chosen layout to its scope without disturbing the other', () => {
    $lensLayout.set({ belief: 'concentric' });
    setActiveLayout('semantic-map');
    expect($layoutScope.get()).toBe('conversation');
    expect($conversationLayout.get()).toBe('semantic-map');
    expect($lensLayout.get().belief).toBe('concentric');
    setActiveLayout('breadthfirst');
    expect($layoutScope.get()).toBe('concept');
    expect($lensLayout.get().belief).toBe('breadthfirst');
    expect($urlState.get().layout).toBe('breadthfirst');
  });

  it('remembers the graph layer per lens', () => {
    $activeLens.set('goal');
    setGraphLayer('concepts');
    $activeLens.set('belief');
    expect($graphLayer.get()).toBe('both');
    $activeLens.set('goal');
    expect($graphLayer.get()).toBe('concepts');
  });

  it('ignores a renderer that is not registered', () => {
    window.location.hash = 'renderer=not-a-renderer';
    hydrateFromUrl();
    expect($activeRenderer.get()).toBe('graph');
    expect($urlState.get().renderer).toBeUndefined();
  });

  it('ignores a layout that is not registered', () => {
    window.location.hash = 'layout=not-a-layout';
    hydrateFromUrl();
    expect($lensLayout.get().belief).toBe('cose');
    expect($urlState.get().layout).toBeUndefined();
  });

  it('mirrors the active lens into the url state', () => {
    $activeLens.set('goal');
    expect($urlState.get().lens).toBe('goal');
  });

  it('reflects panel open state two-way with the url', () => {
    setPanels((id) => id === 'chat');
    expect($urlState.get().panels).toEqual(['chat']);

    window.location.hash = 'panels=search';
    hydrateFromUrl();
    expect($panels.get().get('search')?.open).toBe(true);
    expect($panels.get().get('chat')?.open).toBe(false);
  });
});
