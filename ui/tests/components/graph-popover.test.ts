import type { GraphNodeData } from '@senars/core';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/graph-popover.js';
import { explainLinkModel } from '../../src/client/core/explain.js';
import { narsBackend } from '../../src/client/core/nars-backend.js';
import {
  $activeRenderer,
  $graphEdges,
  $graphNodes,
  $workspaceGraph,
} from '../../src/client/core/store.js';
import { emptyWorkspaceGraph } from '../../src/client/core/workspace-graph.js';
import {
  claimId,
  linkRefFor,
  projectWorkspace,
} from '../../src/client/core/workspace-projection.js';

/** An engine graph projected into workspace blocks, the way the viewport sees it. */
const project = (
  nodes: [string, GraphNodeData][],
  edges: [string, Record<string, unknown>][] = []
): void => {
  $graphNodes.set(new Map(nodes));
  $graphEdges.set(new Map(edges));
  $workspaceGraph.set(projectWorkspace({ messages: [], backend: narsBackend }));
};

const mount = async (ref: string, link = '') => {
  const el = document.createElement('graph-popover');
  el.ref = ref;
  el.link = link;
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

describe('graph edge popover', () => {
  const graphWithEdge = () => {
    project(
      [
        ['bird', { id: 'bird', term: 'bird', nodeType: 'nar:concept' }],
        ['fly', { id: 'fly', term: 'fly', nodeType: 'nar:concept' }],
        ['swarm', { id: 'swarm', term: 'swarm', nodeType: 'nar:concept' }],
      ],
      [
        ['bird->fly', { source: 'bird', target: 'fly', type: 'derivation', confidence: 0.7 }],
        ['swarm->fly', { source: 'swarm', target: 'fly', type: 'support', confidence: 0.3 }],
        ['swarm->bird', { source: 'swarm', target: 'bird', type: 'invented-type' }],
      ]
    );
    return $workspaceGraph.get();
  };

  it('mints the link ref from both endpoints and the backend vocabulary', () => {
    const graph = graphWithEdge();
    const ref = linkRefFor(narsBackend, 'bird->fly');
    expect(ref).toBeDefined();
    expect(graph.links.get(ref!)).toMatchObject({ kind: 'derived-from', confidence: 0.7 });
    expect(linkRefFor(narsBackend, 'ghost->fly')).toBeUndefined();
  });

  it('explains the link, its endpoints, and the block it lands on', async () => {
    graphWithEdge();
    const el = await mount('', linkRefFor(narsBackend, 'bird->fly'));
    const root = el.shadowRoot;
    expect(root?.querySelector('.head .kind')?.textContent).toBe('derived from');
    expect(root?.querySelector('.head .chip')?.textContent).toBe('c0.70');
    // both endpoints are navigable
    const endpoints = [...(root?.querySelectorAll('.row') ?? [])]
      .map((row) => row.getAttribute('data-other'))
      .filter((ref) => ref?.startsWith('claim:bird') || ref?.startsWith('claim:fly'));
    expect(new Set(endpoints)).toEqual(new Set([claimId('bird'), claimId('fly')]));
    // the link being explained is not repeated among the target's own links
    // the target's other links are listed; the link being explained is not repeated
    expect(
      [...(root?.querySelectorAll('.row') ?? [])].some((row) =>
        row.textContent?.includes('supports')
      )
    ).toBe(true);
  });

  it('degrades an engine edge type the vocabulary does not speak', () => {
    const graph = graphWithEdge();
    expect(graph.links.get(linkRefFor(narsBackend, 'swarm->bird')!)?.kind).toBe('references');
  });

  it('explains a link with no confidence and renders nothing for an unknown one', async () => {
    graphWithEdge();
    const el = await mount('', linkRefFor(narsBackend, 'swarm->fly'));
    expect(el.shadowRoot?.querySelector('.head .chip')?.textContent).toBe('c0.30');

    const missing = await mount('', 'link:ghost');
    expect(missing.shadowRoot?.querySelector('.head')).toBeFalsy();
  });

  it('gives the inspector the link facts the popover shows', () => {
    const graph = graphWithEdge();
    const model = explainLinkModel(graph, linkRefFor(narsBackend, 'bird->fly')!);
    expect(model?.source?.id).toBe(claimId('bird'));
    expect(model?.target?.id).toBe(claimId('fly'));
    // The raw model keeps every link touching the target; the popover drops the self-row.
    expect(model?.model.links.map((link) => link.confidence)).toEqual([0.7, 0.3]);
    expect(explainLinkModel(graph, claimId('bird'))).toBeUndefined();
  });
});
