import type { Channel, ChannelValue, Delta } from '../modulation/types.js';

export const SUPPORT_3D: Set<Channel> = new Set([
  'color', 'opacity', 'size', 'label', 'z',
]);

export const SUPPORT_3D_EDGES: Set<Channel> = new Set([
  'color', 'width', 'opacity', 'edge-color',
]);

export function checkUnsupportedChannels(delta: Delta, isEdge: (id: string) => boolean): Channel[] {
  const unsupported: Channel[] = [];
  for (const [id, channels] of delta) {
    const supported = isEdge(id) ? SUPPORT_3D_EDGES : SUPPORT_3D;
    for (const ch of Object.keys(channels) as Channel[]) {
      if (!supported.has(ch)) unsupported.push(ch);
    }
  }
  return [...new Set(unsupported)];
}

function applyNodeVisuals(
  node: { object?: { material?: { color: { set: (c: string) => void }; opacity: number; needsUpdate: boolean }; scale: { setScalar: (s: number) => void } }; data?: Record<string, unknown> },
  channels: Partial<Record<Channel, ChannelValue>>,
): void {
  if (!node.object) return;

  for (const [ch, value] of Object.entries(channels)) {
    switch (ch as Channel) {
      case 'color':
        node.object.material?.color.set(value as string);
        break;
      case 'opacity':
        if (node.object.material) {
          node.object.material.opacity = value as number;
          node.object.material.needsUpdate = true;
        }
        break;
      case 'size': {
        const scale = (value as number) / 40;
        node.object.scale.setScalar(scale);
        break;
      }
      case 'z':
        // z-position handled by layout — skip per-node
        break;
    }
  }
}

function applyEdgeVisuals(
  edge: { object?: { material?: { color: { set: (c: string) => void }; opacity: number } }; width?: number },
  channels: Partial<Record<Channel, ChannelValue>>,
): void {
  for (const [ch, value] of Object.entries(channels)) {
    switch (ch as Channel) {
      case 'edge-color':
      case 'color':
        if (edge.object?.material) {
          edge.object.material.color.set(value as string);
        }
        break;
      case 'width':
        edge.width = value as number;
        break;
      case 'opacity':
        if (edge.object?.material) {
          edge.object.material.opacity = value as number;
        }
        break;
    }
  }
}

export function applyDelta(
  sg: { forNodes: (fn: (node: any) => void) => void; getNode?: (id: string) => any; getEdge?: (id: string) => any; updatePosition?: (id: string, position: [number, number, number]) => void },
  delta: Delta,
): void {
  for (const [id, channels] of delta) {
    const edge = sg.getEdge ? sg.getEdge(id) : undefined;
    if (edge) {
      applyEdgeVisuals(edge, channels);
      continue;
    }
    const node = sg.getNode ? sg.getNode(id) : undefined;
    if (node) {
      applyNodeVisuals(node, channels);
      // Apply z-position for 3D temporal mapping
      if (channels.z !== undefined && sg.updatePosition) {
        const z = channels.z as number;
        const pos = node.position ?? [0, 0, 0];
        sg.updatePosition(id, [pos[0], pos[1], z]);
      }
    }
  }
}

export function clearNodeStyles(
  sg: { forNodes: (fn: (node: any) => void) => void },
): void {
  sg.forNodes((node: any) => {
    if (!node.object) return;
    if (node.object.material) {
      node.object.material.color.set('#00f3ff');
      node.object.material.opacity = 0.15;
      node.object.material.needsUpdate = true;
    }
    node.object.scale.setScalar(1);
  });
}
