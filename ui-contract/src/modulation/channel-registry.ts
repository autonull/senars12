/**
 * Channel registry — open modulation channels (§5).
 *
 * Every channel is a declared spec with fallback; renderers declare what they
 * honour via `RendererCaps.channels`; unsupported channels degrade through
 * their declared fallback. This replaces the closed `CHANNELS` tuple.
 */

import type { ChannelValue } from './types.js';
import { createRegistry } from '../core/registry-factory.js';

export interface ChannelSpec {
  readonly id: string;
  readonly of: 'node' | 'edge' | 'both';
  readonly value: 'string' | 'number' | 'boolean' | 'enum';
  readonly fallback?: ChannelValue;
  readonly description?: string;
}

/** The core channels SeNARS registers by default. */
export const CORE_CHANNELS: readonly ChannelSpec[] = [
  { id: 'color', of: 'both', value: 'string', fallback: '#6366f1', description: 'Primary color encoding truth/attention' },
  { id: 'opacity', of: 'both', value: 'number', fallback: 1, description: 'Confidence/transparency' },
  { id: 'size', of: 'node', value: 'number', fallback: 20, description: 'Attention/priority sizing' },
  { id: 'label', of: 'node', value: 'string', fallback: '', description: 'Text label override' },
  { id: 'stroke.dash', of: 'node', value: 'boolean', fallback: false, description: 'System origin — proposed vs derived' },
  { id: 'stroke.width', of: 'node', value: 'number', fallback: 1, description: 'Border emphasis' },
  { id: 'z', of: 'node', value: 'number', fallback: 0, description: 'Depth/layer ordering' },
  { id: 'flow.enable', of: 'edge', value: 'boolean', fallback: false, description: 'Liveness/animation' },
  { id: 'line-style', of: 'edge', value: 'string', fallback: 'solid', description: 'Relation kind encoding' },
  { id: 'width', of: 'edge', value: 'number', fallback: 1, description: 'Edge weight/strength' },
  { id: 'edge-color', of: 'edge', value: 'string', fallback: '#6366f1', description: 'Edge color by relation' },
] as const;

// Create the registry using the generic factory
const channelRegistry = createRegistry<ChannelSpec>({
  registryName: 'Channel',
  coreEntries: CORE_CHANNELS,
  keyOf: (c) => c.id,
});

// Add extra queries after creation to avoid circular references
const channelFallback = (id: string): ChannelValue | undefined => channelRegistry.get(id)?.fallback;

const channelsFor = (target: 'node' | 'edge'): readonly ChannelSpec[] =>
  channelRegistry.getAll().filter((c) => c.of === target || c.of === 'both');

// Re-export the standard registry API
export const {
  register: registerChannel,
  get: getChannel,
  getAll: getChannels,
  has: hasChannel,
  ids: channelIds,
  reset: resetChannels,
} = channelRegistry;

// Re-export extra queries
export { channelFallback, channelsFor };

/** Register the core SeNARS channels. */
export const registerCoreChannels = (): void => {
  for (const spec of CORE_CHANNELS) registerChannel(spec);
}

/** Type of registered channel IDs (for exhaustiveness in adapters). */
export type RegisteredChannel = ChannelSpec['id'];