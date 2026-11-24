/**
 * Shape Registry — registry for UI shapes.
 *
 * Thin wrapper over the unified factory's shape registry.
 */

import { getUIContractRegistryFactory, type ShapeEntry, type Registry } from './index';

/** Shape registry interface. */
export interface ShapeRegistry extends Registry<ShapeEntry> {}

/** Get the shape registry. */
export function getShapeRegistry(): ShapeRegistry {
  return getUIContractRegistryFactory().shapeRegistry();
}

/** Create a new shape registry. */
export function createShapeRegistry(): ShapeRegistry {
  return getUIContractRegistryFactory().shapeRegistry();
}