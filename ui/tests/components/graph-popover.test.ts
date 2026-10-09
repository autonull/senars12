import type { GraphNodeData } from '@senars/core';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/graph-popover.js';
import { narsBackend } from '../../src/client/core/nars-backend.js';
import {
  $activeRenderer,
  $graphEdges,
  $graphNodes,
  $workspaceGraph,
} from '../../src/client/core/store.js';
import { emptyWorkspaceGraph } from '../../src/client/core/workspace-graph.js';
import { claimId, projectWorkspace } from '../../src/client/core/workspace-projection.js';

/** An engine graph projected into workspace blocks, the way the viewport sees it. */
const project = (
  nodes: [string, GraphNodeData][],
  edges: [string, Record<string, unknown>][] = []
): void => {
  $graphNodes.set(new Map(nodes));
  $graphEdges.set(new Map(edges));
  $workspaceGraph.set(projectWorkspace({ messages: [], backend: narsBackend }));
};

const mount = async (ref: string) => {
  const el = document.createElement('graph-popover');
  el.ref = ref;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
  $activeRenderer.set('graph');
  $graphNodes.set(new Map());
  $graphEdges.set(new Map());
  $workspaceGraph.set(emptyWorkspaceGraph());
});

describe('graph node popover', () => {
  it('explains the hovered node: identity, truth and every link touching it', async () => {
    project([
      [
        'bird',
        {
          id: 'bird',
          term: 'bird',
          nodeType: 'nar:concept',
          truth: { frequency: 0.9, confidence: 0.8 },
        },
      ],
      ['fly', { id: 'fly', term: 'fly', nodeType: 'nar:concept' }],
    ]);
    const el = await mount(claimId('bird'));
    expect(el.shadowRoot?.querySelector('.kind')?.textContent).toBe('Claim');
    expect(el.shadowRoot?.querySelector('.label')?.textContent).toBe('bird');
    expect(el.shadowRoot?.querySelector('.chip')?.textContent).toContain('f0.90');
  });

  it('says so when a block has no links yet', async () => {
    project([['bird', { id: 'bird', term: 'bird', nodeType: 'nar:concept' }]]);
    const el = await mount(claimId('bird'));
    expect(el.shadowRoot?.querySelector('.empty')?.textContent).toBe('No links yet');
  });

  it('renders nothing for a block that does not exist', async () => {
    project([['bird', { id: 'bird', term: 'bird', nodeType: 'nar:concept' }]]);
    const el = await mount('claim:ghost');
    expect(el.shadowRoot?.querySelector('.head')).toBeFalsy();
  });

  it('escapes an engine term instead of marking it up', async () => {
    project([['x', { id: 'x', term: '<img src=x onerror=alert(1)>', nodeType: 'nar:concept' }]]);
    const el = await mount(claimId('x'));
    expect(el.shadowRoot?.querySelector('img')).toBeFalsy();
    expect(el.shadowRoot?.querySelector('.label')?.textContent).toBe(
      '<img src=x onerror=alert(1)>'
    );
  });

  it('follows a link row into the notebook', async () => {
    project(
      [
        ['bird', { id: 'bird', term: 'bird', nodeType: 'nar:concept' }],
        ['fly', { id: 'fly', term: 'fly', nodeType: 'nar:concept' }],
      ],
      [['e1', { source: 'bird', target: 'fly', type: 'derivation' }]]
    );
    const el = await mount(claimId('bird'));
    const rows = [...(el.shadowRoot?.querySelectorAll('.row') ?? [])];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute('data-other')).toBe(claimId('fly'));
    rows[0]?.click();
    expect($activeRenderer.get()).toBe('notebook');
    expect($workspaceGraph.get().focus).toBe(claimId('fly'));
  });
});
