/**
 * Modulation — the neutral visual channel contract (§5).
 */

export {
  registerChannel,
  getChannel,
  getChannels,
  hasChannel,
  channelIds,
  resetChannels,
  CORE_CHANNELS,
  registerCoreChannels,
  channelFallback,
  channelsFor,
  type ChannelSpec,
  type RegisteredChannel,
} from './channel-registry';

export type {
  Channel,
  ChannelValue,
  Delta,
  Item,
  ViewFlags,
  View,
  Lens,
  Modulation,
} from './types';

export { CHANNELS, asChannel, isChannel } from './types';