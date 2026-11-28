/**
 * Health status levels — shared to avoid circular dependencies.
 */
export declare const HEALTH_STATUSES: readonly ['healthy', 'degraded', 'stuck', 'crashed'];
export type HealthLevel = (typeof HEALTH_STATUSES)[number];
//# sourceMappingURL=health-status.d.ts.map