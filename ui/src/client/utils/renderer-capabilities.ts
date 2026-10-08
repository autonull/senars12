/**
 * The renderer capability matrix: which modulation channels each viewport can
 * actually paint, per element kind. It is the one place the sets live — the
 * adapters declare their support by reading it (`adapter-2d`/`adapter-3d`), the
 * unsupported-channel warning derives from it, and the lens capability surface
 * (§3.4/§8.2) can reject a channel no active renderer supports instead of
 * silently no-op'ing it during paint.
 *
 * `satisfies Record<RendererId, …>` keeps the matrix exhaustive: a renderer
 * without a row, or an unknown renderer key, fails the build.
 */

import { unique } from '@senars/util';
import type { Channel, Delta } from '../modulation/types.js';

export type RendererId = '2d' | '3d';
export type RenderTarget = 'node' | 'edge';

export type RendererCapability = {
  readonly node: ReadonlySet<Channel>;
  readonly edge: ReadonlySet<Channel>;
};

const channels = (...names: Channel[]): ReadonlySet<Channel> => new Set(names);

export const RENDERER_CAPABILITIES = {
  '2d': {
    node: channels('color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z'),
    edge: channels('color', 'edge-color', 'width', 'line-style', 'opacity'),
  },
  '3d': {
    node: channels('color', 'opacity', 'size', 'label', 'z'),
    edge: channels('color', 'edge-color', 'width', 'opacity'),
  },
} as const satisfies Record<RendererId, RendererCapability>;

export const supportsChannel = (
  renderer: RendererId,
  target: RenderTarget,
  channel: Channel
): boolean => RENDERER_CAPABILITIES[renderer][target].has(channel);

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
  for (const [id, assigned] of delta) {
    const supported = RENDERER_CAPABILITIES[renderer][isEdge(id) ? 'edge' : 'node'];
    for (const channel of Object.keys(assigned) as Channel[]) {
      if (!supported.has(channel)) unsupported.push(channel);
    }
  }
  return unique(unsupported);
}