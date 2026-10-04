/**
 * The risk vocabulary the capability sandbox, the approval service, and a
 * self-modification proposal's tier share.
 *
 * A leaf on purpose: `core`'s `ApprovalService` cannot import nar, so before this
 * existed the three-member union was written out at five sites across the two
 * packages and adding a tier meant editing all five. The tiers mean one thing in
 * all three places — `low` may take effect unattended, `medium` waits for
 * validation, `high` waits for a human — which is what lets them be one type.
 */
import { z } from 'zod';

export const CAPABILITY_RISKS = ['low', 'medium', 'high'] as const;

export const CapabilityRiskSchema = z.enum(CAPABILITY_RISKS);

export type CapabilityRisk = (typeof CAPABILITY_RISKS)[number];
