/** @public The one injectable time source; every bounded container and cache takes one. */
export type { Clock } from './clock';
export { fixedClock, systemClock } from './clock';