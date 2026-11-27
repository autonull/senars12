import { z } from 'zod';
/**
 * Capability risk tiers — shared to avoid circular dependencies.
 * `low` may take effect unattended, `medium` waits for validation, `high` waits for a human.
 */
export declare const CAPABILITY_RISKS: readonly ['low', 'medium', 'high'];
export declare const CapabilityRiskSchema: z.ZodEnum<{
    high: "high";
    low: "low";
    medium: "medium";
}>;
export type CapabilityRisk = (typeof CAPABILITY_RISKS)[number];
//# sourceMappingURL=capability-risk.d.ts.map