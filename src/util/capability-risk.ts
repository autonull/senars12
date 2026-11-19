import { z } from 'zod';

/**
 * Capability risk tiers — shared to avoid circular dependencies.
 * `low` may take effect unattended, `medium` waits for validation, `high` waits for a human.
 */
export const CAPABILITY_RISKS = ['low', 'medium', 'high'] as const;

export const CapabilityRiskSchema = z.enum(CAPABILITY_RISKS);

export type CapabilityRisk = (typeof CAPABILITY_RISKS)[number];