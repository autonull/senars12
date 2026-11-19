/**
 * Health status levels — shared to avoid circular dependencies.
 */
export const HEALTH_STATUSES = ['healthy', 'degraded', 'stuck', 'crashed'] as const;
export type HealthLevel = (typeof HEALTH_STATUSES)[number];