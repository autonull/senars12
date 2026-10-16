/**
 * Channel registry — open modulation channels (§5).
 *
 * Every channel is a declared spec with fallback; renderers declare what they
 * honour via `RendererCaps.channels`; unsupported channels degrade through
 * their declared fallback. This replaces the closed `CHANNELS` tuple.
 */

import type { ChannelValue } from './types.js';

export interface ChannelSpec {
  readonly id: string;
  readonly of: 'node' | 'edge' | 'both';
  readonly value: 'string' | 'number' | 'boolean' | 'enum';
  readonly fallback?: ChannelValue;
  readonly description?: string;
}

const channelRegistry = new Map<string, ChannelSpec>();
const registrationOrder: string[] = [];

/** Register a modulation channel. */
export const registerChannel = (spec: ChannelSpec): void => {
  if (channelRegistry.has(spec.id)) {
    console.warn(`Channel ${spec.id} already registered; overwriting`);
  } else {
    registrationOrder.push(spec.id);
  }
  channelRegistry.set(spec.id, spec);
};

/** Get a registered channel spec. */
export const getChannel = (id: string): ChannelSpec | undefined => channelRegistry.get(id);

/** All registered channels in registration order. */
export const getChannels = (): readonly ChannelSpec[] => registrationOrder.map((id) => channelRegistry.get(id)!);

/** Whether a channel is registered. */
export const hasChannel = (id: string): boolean => channelRegistry.has(id);

/** Channel IDs in registration order. */
export const channelIds = (): readonly string[] => [...registrationOrder];

/** Clear the registry (test-only). */
export const resetChannels = (): void => {
  channelRegistry.clear();
  registrationOrder.length = 0;
};

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

/** Register the core SeNARS channels. */
export const registerCoreChannels = (): void => {
  for (const spec of CORE_CHANNELS) registerChannel(spec);
};

/** Type of registered channel IDs (for exhaustiveness in adapters). */
export type RegisteredChannel = ChannelSpec['id'];

/** Get the fallback value for a channel. */
export const channelFallback = (id: string): ChannelValue | undefined => getChannel(id)?.fallback;

/** Get channels applicable to a target kind. */
export const channelsFor = (target: 'node' | 'edge'): readonly ChannelSpec[] =>
  getChannels().filter((c) => c.of === target || c.of === 'both');