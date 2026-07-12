import type { WebSocket } from 'ws';
import { LENS_FIELDS } from '@senars/core/constants';
import type { LensSpec } from '@senars/core/lens-schema';
import type { GraphNodeData, GraphOp, IncomingFromServer, Lens } from '@senars/core/protocol';
import type { CognitiveBridge } from './cognitive-bridge.js';
import { DEFAULT_PROJECTION } from './config.js';
import { lensRegistry } from './gateway.js';
import { computeActiveSubgraph } from './projection.js';

function createNodeOp(id: string, data: GraphNodeData): GraphOp {
  return { action: 'add_node' as const, id, data };
}

function createEdgeOp(source: string, target: string, weight: number, type = 'semantic'): GraphOp {
  return { action: 'add_edge' as const, source, target, data: { weight, type, directed: true } };
}

const cn = (
  id: string,
  label: string,
  priority: number,
  confidence: number,
  extra?: Partial<GraphNodeData>
) => createNodeOp(id, { id, label, priority, confidence, nodeType: 'nar:concept' as const, ...extra });

export function send(socket: WebSocket, msg: IncomingFromServer): void {
  socket.send(JSON.stringify(msg));
}

function beliefGraphDelta(
  bridge: CognitiveBridge,
  lens?: Lens
): { ops: GraphOp[]; meta?: { truncated: boolean; totalHidden: number } } {
  if (lens) return { ops: [], meta: undefined };
  const concepts = bridge.listConcepts();
  const proj = computeActiveSubgraph(
    concepts.map((c) => ({
      term: c.term,
      priority: c.priority,
      confidence: c.confidence,
      getLinks: c.getLinks,
    })),
    null,
    DEFAULT_PROJECTION
  );
  const nodeSet = new Set(proj.nodes.map((n) => n.id));

  return {
    ops: [
      ...concepts
        .filter((c) => nodeSet.has(c.term))
        .map((c) =>
          cn(c.term, c.term, c.priority, c.confidence, { isContradiction: c.isContradiction })
        ),
      ...proj.edges.map((e) => createEdgeOp(e.source, e.target, e.weight)),
    ],
    meta: proj.truncated ? { truncated: true, totalHidden: proj.total_hidden } : undefined,
  };
}

function workingMemoryDelta(bridge: CognitiveBridge): GraphOp[] {
  return bridge
    .attentionReport()
    .concepts.map((c) => cn(c.term.toString(), c.term.toString(), c.priority, 0.9));
}

function driveDelta(bridge: CognitiveBridge): GraphOp[] | null {
  const drives = bridge.getDriveManager()?.getAllStates();
  return drives?.map((d) => cn(d.spec.id, d.spec.name, d.currentIntensity, 1)) ?? null;
}

/** Send the full lens registry to a socket. */
export function sendLensList(socket: WebSocket | ((msg: IncomingFromServer) => void)): void {
  const lenses: LensSpec[] = [];
  for (const spec of lensRegistry.values()) {
    lenses.push(spec);
  }
  const msg = { type: 'lens.list' as const, lenses: lenses as unknown as LensSpec[] };
  if (typeof socket === 'function') {
    socket(msg as IncomingFromServer);
  } else {
    send(socket, msg as IncomingFromServer);
  }
}

/** Broadcast a lens.defined message — for use with send functions. */
export function broadcastLensDefined(
  sendFn: (msg: IncomingFromServer) => void,
  spec: LensSpec
): void {
  sendFn({ type: 'lens.defined', lens: spec } as IncomingFromServer);
}

/** Send the available lens fields for the designer. */
function sendLensFields(socket: WebSocket | ((msg: IncomingFromServer) => void)): void {
  const msg: IncomingFromServer = {
    type: 'lens.fields',
    fields: LENS_FIELDS,
  } as IncomingFromServer;
  if (typeof socket === 'function') {
    socket(msg);
  } else {
    send(socket, msg);
  }
}

export function sendInitialState(socket: WebSocket, bridge: CognitiveBridge, lens?: Lens): void {
  send(socket, { type: 'config.schema', data: bridge.getConfigSchema() });
  sendLensList(socket);
  sendLensFields(socket);
  const bg = beliefGraphDelta(bridge, lens);
  send(socket, {
    type: 'cognitive.delta',
    seqId: Date.now(),
    lens: lens ?? 'belief',
    ops: bg.ops,
    meta: bg.meta,
  });
  send(socket, {
    type: 'cognitive.delta',
    seqId: Date.now() + 1,
    lens: 'belief',
    ops: workingMemoryDelta(bridge),
  });
  const drives = driveDelta(bridge);
  if (drives)
    send(socket, { type: 'cognitive.delta', seqId: Date.now() + 2, lens: 'belief', ops: drives });
}

type Unsubscribe = () => void;

export function subscribeBridgeEvents(
  socket: WebSocket,
  bridge: CognitiveBridge,
  currentLens: () => Lens
): Unsubscribe[] {
  let seqId = Date.now();
  const bus = bridge.getSystemEventBus();
  return [
    bus.on('nar:derivation', () => {
      const { ops, meta } = beliefGraphDelta(bridge, currentLens());
      send(socket, { type: 'cognitive.delta', seqId: ++seqId, lens: currentLens(), ops, meta });
    }),
    bus.on('nar:concept:activated', (...args: unknown[]) => {
      const d = args[0] as Record<string, unknown> | undefined;
      const termRaw = d?.term;
      const term = termRaw && typeof termRaw === 'string' ? termRaw : '';
      const priority = typeof d?.priority === 'number' ? d.priority : 0.5;
      const concepts = bridge.listConcepts();
      const concept = concepts.find((c) => c.term === term);
      const node: GraphNodeData = {
        id: term,
        label: term,
        priority,
        confidence: concept?.confidence ?? 0.9,
        nodeType: 'nar:concept',
        isContradiction: concept?.isContradiction ?? false,
      };
      send(socket, {
        type: 'cognitive.delta',
        seqId: ++seqId,
        lens: 'belief',
        ops: [createNodeOp(term, node)],
      });
    }),
    bus.on('nar:reasoning:cycle', (...args: unknown[]) => {
      const d = args[0] as Record<string, unknown> | undefined;
      const cycle = typeof d?.cycle === 'number' ? d.cycle : 0;
      send(socket, {
        type: 'cognitive.delta',
        seqId: ++seqId,
        lens: 'belief',
        ops: [cn('cycle', 'cycle', cycle, 1)],
      });
    }),
    bus.on('nar:drive:changed', (...args: unknown[]) => {
      const d = args[0] as Record<string, unknown> | undefined;
      const id = typeof d?.drive === 'string' ? d.drive : 'drive';
      const urgency = typeof d?.urgency === 'number' ? d.urgency : 0;
      send(socket, {
        type: 'cognitive.delta',
        seqId: ++seqId,
        lens: 'belief',
        ops: [cn(id, id, urgency, 1)],
      });
    }),
  ];
}

export function subscribeSocket(
  socket: WebSocket,
  bridge: CognitiveBridge,
  currentLens: () => Lens
): Unsubscribe {
  const all = [...subscribeBridgeEvents(socket, bridge, currentLens)];
  return () => {
    for (const u of all) u();
  };
}
