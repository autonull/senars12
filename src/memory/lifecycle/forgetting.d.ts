import type { Concept } from '../concept';
export type ForgettingPolicy = 'fifo' | 'lowest-priority';
export declare class Forgetting {
    private readonly policy;
    constructor(policy?: ForgettingPolicy);
    selectVictim(concepts: Iterable<Concept>): Concept | undefined;
}
//# sourceMappingURL=forgetting.d.ts.map