import type { GraphNodeData } from '@senars/core';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/client/components/overlays/inspector.js';
import { eventBus } from '../../src/client/core/events.js';
import { narsBackend } from '../../src/client/core/nars-backend.js';
import { overlayDescriptor } from '../../src/client/core/overlay-registry.js';
import {
  $activeRenderer,
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
  $workspaceGraph.set(projectWorkspace({ messages: [], backend: narsBackend }));
};

const actions = async (el: HTMLElement): Promise<void> => {
  const tabs = [...(el.shadowRoot?.querySelectorAll('.tab') ?? [])];
  tabs[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await el.updateComplete;
};

afterEach(() => {
  document.body.innerHTML = '';
  $selectedNodeId.set(null);
  $selectedEdgeId.set(null);
  $activeRenderer.set('graph');
  $graphNodes.set(new Map());
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
