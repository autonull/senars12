/**
 * The renderer capability matrix: which modulation channels each viewport can
 * actually paint, per element kind. It is the one place the sets live — the
 * adapters declare their support by reading it (`adapter-2d`/`adapter-3d`), the
 * unsupported-channel warning derives from it, and the lens capability surface
 * (§3.4/§8.2) can reject a channel no active renderer supports instead of
 * silently no-op'ing it during paint.
 *
 * The capability matrix is derived from the workspace renderer registry (A0.1).
 * Canonical renderer ids: `graph-2d`, `graph-3d`, `notebook`.
 */

import { unique } from '@senars/util';
import type { Channel, Delta } from '../modulation/types.js';
import { workspaceRenderer, workspaceRendererIds } from '../core/workspace-renderer.js';

export type RenderTarget = 'node' | 'edge';

/** The modulation channels a renderer supports, per element kind. */
export type RendererCapability = {
  readonly node: ReadonlySet<Channel>;
  readonly edge: ReadonlySet<Channel>;
};

/** Static fallback capabilities (used when registry is empty, e.g. in tests). */
const STATIC_CAPABILITIES: Record<string, RendererCapability> = {
  'graph-2d': {
    node: new Set<Channel>(['color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z']),
    edge: new Set<Channel>(['color', 'edge-color', 'width', 'line-style', 'opacity']),
  },
  'graph-3d': {
    node: new Set<Channel>(['color', 'opacity', 'size', 'label', 'z']),
    edge: new Set<Channel>(['color', 'edge-color', 'width', 'opacity']),
  },
  'notebook': {
    node: new Set<Channel>(),
    edge: new Set<Channel>(),
  },
};

/** Get the capability matrix from registered workspace renderers, with static fallback. */
export function getRendererCapabilities(): Record<string, RendererCapability> {
  const ids = workspaceRendererIds();
  if (ids.length === 0) {
    return STATIC_CAPABILITIES;
  }
  const matrix: Record<string, RendererCapability> = {};
  for (const id of ids) {
    const renderer = workspaceRenderer(id);
    if (renderer) {
      const caps = renderer.capabilities();
      matrix[id] = caps.channels ?? { node: new Set(), edge: new Set() };
    }
  }
  return matrix;
}

/** Get capabilities for a specific renderer id, with static fallback. */
export function getRendererCapability(id: string): RendererCapability | undefined {
  const renderer = workspaceRenderer(id);
  if (renderer) {
    const caps = renderer.capabilities();
    return caps.channels ?? { node: new Set(), edge: new Set() };
  }
  // Fallback to static definitions for test environments
  return STATIC_CAPABILITIES[id];
}

/** Type for renderer ids that have declared capabilities. */
export type RendererId = string;

export const supportsChannel = (
  renderer: RendererId,
  target: RenderTarget,
  channel: Channel
): boolean => getRendererCapability(renderer)?.[target]?.has(channel) ?? false;

/**
 * The channels a delta assigns that the given renderer cannot paint — reported
 * (not dropped) so a lens author learns their mapping has no effect here.
 */
export function unsupportedChannels(
  delta: Delta,
  renderer: RendererId,
  isEdge: (id: string) => boolean
): Channel[] {
  const unsupported: Channel[] = [];
  const caps = getRendererCapability(renderer);
  if (!caps) return unsupported;
  for (const [id, assigned] of delta) {
    const supported = caps[isEdge(id) ? 'edge' : 'node'];
    for (const channel of Object.keys(assigned) as Channel[]) {
      if (!supported.has(channel)) unsupported.push(channel);
    }
  }
  return unique(unsupported);
}

/** Back-compat: the full capability matrix as an object (evaluated at call time). */
export const RENDERER_CAPABILITIES = new Proxy({} as Record<string, RendererCapability>, {
  get(_target, prop: string) {
    return getRendererCapability(prop);
  },
  ownKeys() {
    const ids = workspaceRendererIds();
    return ids.length > 0 ? ids : Object.keys(STATIC_CAPABILITIES);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const caps = getRendererCapability(prop);
    return caps ? { value: caps, enumerable: true, configurable: true } : undefined;
  },
});