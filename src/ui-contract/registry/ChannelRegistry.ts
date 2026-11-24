/**
 * Channel Registry — registry for UI channels.
 *
 * Thin wrapper over the unified factory's channel registry.
 */

import { getUIContractRegistryFactory, type ChannelEntry, type Registry } from './index';

/** Channel registry interface. */
export interface ChannelRegistry extends Registry<ChannelEntry> {}

/** Get the channel registry. */
export function getChannelRegistry(): ChannelRegistry {
  return getUIContractRegistryFactory().channelRegistry();
}

/** Create a new channel registry. */
export function createChannelRegistry(): ChannelRegistry {
  return getUIContractRegistryFactory().channelRegistry();
}