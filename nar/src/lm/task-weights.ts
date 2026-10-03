import { createTaskWeight, type Budget } from '../types/core.js';

export type LMWeightKind = 'enrichment' | 'context' | 'revision' | 'fallback';

const LM_WEIGHT_DEFAULTS: Record<LMWeightKind, readonly [priority: number, durability: number]> =
  {
    enrichment: [0.4, 0.8],
    context: [0.5, 0.8],
    revision: [0.7, 0.8],
    fallback: [0.7, 0.8],
  } as const;

export const lmTaskWeight = (kind: LMWeightKind, priority?: number): Budget => {
  const [defaultPriority, durability] = LM_WEIGHT_DEFAULTS[kind];
  return createTaskWeight(priority ?? defaultPriority, durability);
};

export interface SystemOneBudgetShape {
  durability: number;
  quality: number;
  cycles: number;
  depth: number;
}

export const SYSTEM_ONE_BUDGET: SystemOneBudgetShape = {
  durability: 0.7,
  quality: 0.8,
  cycles: 10,
  depth: 5,
} as const;

export const systemOneTaskWeight = (
  priority: number,
  shape: Partial<SystemOneBudgetShape> = {}
): Budget => {
  const { durability, quality, cycles, depth } = { ...SYSTEM_ONE_BUDGET, ...shape };
  return createTaskWeight(priority, durability, quality, cycles, depth);
};
