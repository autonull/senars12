/**
 * View Spec Registry — registry for UI view specifications.
 *
 * Thin wrapper over the unified factory's view spec registry.
 */

import { getUIContractRegistryFactory, type ViewSpecEntry, type Registry } from './index';

/** View spec registry interface. */
export interface ViewSpecRegistry extends Registry<ViewSpecEntry> {}

/** Get the view spec registry. */
export function getViewSpecRegistry(): ViewSpecRegistry {
  return getUIContractRegistryFactory().viewSpecRegistry();
}

/** Create a new view spec registry. */
export function createViewSpecRegistry(): ViewSpecRegistry {
  return getUIContractRegistryFactory().viewSpecRegistry();
}