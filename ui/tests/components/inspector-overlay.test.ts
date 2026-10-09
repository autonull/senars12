import type { GraphNodeData } from '@senars/core';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/inspector.js';
import { eventBus } from '../../src/client/core/events.js';
import { narsBackend } from '../../src/client/core/nars-backend.js';
import { overlayDescriptor } from '../../src/client/core/overlay-registry.js';
import {
  $activeRenderer,
  $graphEdges,
  $graphNodes,
  $selectedEdgeId,
  $selectedNodeId,
  $workspaceGraph,
} from '../../src/client/core/store.js';
import { emptyWorkspaceGraph } from '../../src/client/core/workspace-graph.js';
import { projectWorkspace } from '../../src/client/core/workspace-projection.js';

/** The engine graph and the projection that turns it into blocks. */
const engine = (...ids: string[]): void => {
  $graphNodes.set(
    new Map(
      ids.map((id): [string, GraphNodeData] => [id, { id, term: id, nodeType: 'nar:concept' }])
    )
  );
  $graphEdges.set(new Map());
  $workspaceGraph.set(projectWorkspace({ messages: [], backend: narsBackend }));
};

const openTab = async (el: HTMLElement, index: number): Promise<void> => {
  const tabs = [...(el.shadowRoot?.querySelectorAll('.tab') ?? [])];
  tabs[index]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await el.updateComplete;
};

const actions = (el: HTMLElement): Promise<void> => openTab(el, 2);
const links = (el: HTMLElement): Promise<void> => openTab(el, 1);

afterEach(() => {
  document.body.innerHTML = '';
  $selectedNodeId.set(null);
  $selectedEdgeId.set(null);
  $activeRenderer.set('graph');
  $graphNodes.set(new Map());
  $graphEdges.set(new Map());
  $workspaceGraph.set(emptyWorkspaceGraph());
});

const query = <T extends Element>(root: ParentNode | null | undefined, selector: string): T => {
  const found = root?.querySelector(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found as T;
};

describe('inspector overlay', () => {
  it('registers a non-modal popover that does not steal focus', () => {
    const descriptor = overlayDescriptor('inspector');
    expect(descriptor).toMatchObject({
      id: 'inspector',
      title: 'Inspector',
      tag: 's-inspector',
      autoFocus: false,
    });
    expect(descriptor?.modal).toBeUndefined();
    expect(descriptor?.hiddenInPalette).toBeUndefined();
  });

  it('hosts the node detail drawer', async () => {
    const el = document.createElement('s-inspector');
    document.body.appendChild(el);
    await el.updateComplete;
    expect(query(el.shadowRoot, 'node-detail-drawer')).toBeTruthy();
  });

  it('clears the selection and closes through the overlay host', async () => {
    $selectedNodeId.set('n1');
    const el = document.createElement('s-inspector');
    document.body.appendChild(el);
    await el.updateComplete;

    const closed: string[] = [];
    const unsubscribe = eventBus.on('overlay:close', ({ id }) => id && closed.push(id));
    query<HTMLButtonElement>(el.shadowRoot, '.close').click();
    unsubscribe();

    expect($selectedNodeId.get()).toBeNull();
    expect(closed).toEqual(['inspector']);
  });
});

describe('inspector node affordances', () => {
  it('opens the selected node’s block in the notebook', async () => {
    engine('n1');
    $selectedNodeId.set('n1');
    const el = document.createElement('node-detail-drawer');
    document.body.appendChild(el);
    await el.updateComplete;
    await actions(el);

    query<HTMLButtonElement>(el.shadowRoot, 'button[data-action="open-block"]').click();
    expect($activeRenderer.get()).toBe('notebook');
    expect($workspaceGraph.get().focus).toBe('claim:n1');
  });

  it('hides the block affordance for a node the backend does not carry', async () => {
    $selectedNodeId.set('ghost');
    const el = document.createElement('node-detail-drawer');
    document.body.appendChild(el);
    await el.updateComplete;
    await actions(el);
    expect(el.shadowRoot?.querySelector('button[data-action="open-block"]')).toBeFalsy();
  });
});

describe('inspector links tab', () => {
  const drawerFor = async (nodeId: string): Promise<HTMLElement> => {
    const el = document.createElement('node-detail-drawer');
    document.body.appendChild(el);
    $selectedNodeId.set(nodeId);
    await el.updateComplete;
    await links(el);
    return el;
  };

  const withEdge = (): void => {
    engine('bird', 'fly');
    const edge: Record<string, unknown> = {
      source: 'bird',
      target: 'fly',
      type: 'derivation',
      confidence: 0.7,
    };
    $graphEdges.set(new Map([['bird->fly', edge]]));
    $workspaceGraph.set(projectWorkspace({ messages: [], backend: narsBackend }));
  };

  it('explains the links of the node instead of its raw engine edges', async () => {
    withEdge();
    const el = await drawerFor('bird');
    const rows = [...(el.shadowRoot?.querySelectorAll('.link-item') ?? [])];
    expect(rows).toHaveLength(1);
    // the link catalog names the relationship, not the engine's `type` string
    expect(rows[0]?.querySelector('.link-type')?.textContent).toContain('derived from');
    expect(rows[0]?.querySelector('.link-label')?.textContent).toBe('fly');
    expect([...(rows[0]?.querySelectorAll('.chip') ?? [])].map((chip) => chip.textContent)).toEqual(
      ['c0.70', '1 events']
    );
  });

  it('takes the reader to the other block of a link', async () => {
    withEdge();
    const el = await drawerFor('bird');
    query<HTMLButtonElement>(el.shadowRoot, '.link-item').click();
    expect($activeRenderer.get()).toBe('notebook');
    expect($workspaceGraph.get().focus).toBe('claim:fly');
  });

  it('reports a node whose block has no links yet', async () => {
    engine('bird');
    const el = await drawerFor('bird');
    expect(el.shadowRoot?.querySelector('.link-item')).toBeFalsy();
    expect(el.shadowRoot?.textContent).toContain('No outgoing links');
  });
});
