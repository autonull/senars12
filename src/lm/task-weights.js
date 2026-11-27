import { createTaskWeight } from '../types/core';
const LM_WEIGHT_DEFAULTS = {
    enrichment: [0.4, 0.8],
    context: [0.5, 0.8],
    revision: [0.7, 0.8],
    fallback: [0.7, 0.8],
};
export const lmTaskWeight = (kind, priority) => {
    const [defaultPriority, durability] = LM_WEIGHT_DEFAULTS[kind];
    return createTaskWeight(priority ?? defaultPriority, durability);
};
export const SYSTEM_ONE_BUDGET = {
    durability: 0.7,
    quality: 0.8,
    cycles: 10,
    depth: 5,
};
export const systemOneTaskWeight = (priority, shape = {}) => {
    const { durability, quality, cycles, depth } = { ...SYSTEM_ONE_BUDGET, ...shape };
    return createTaskWeight(priority, durability, quality, cycles, depth);
};
