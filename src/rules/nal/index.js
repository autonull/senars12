import * as comparison from './comparison';
import * as core from './core';
import * as higherOrder from './higher-order';
import * as logic from './logic';
import * as propositional from './propositional';
export const NALRules = {
    ...core,
    ...logic,
    ...propositional,
    ...higherOrder,
    ...comparison,
};
