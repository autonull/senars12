import type { BeliefInfo, ConflictInfo } from '../types';
export declare function buildGenerationPrompt(opts: {
    query: string;
    beliefs: BeliefInfo[];
    conflicts: ConflictInfo[];
    derivationSteps?: number;
    reasoningType?: string;
    keyPremises?: string[];
    gaps?: string[];
    userProfile?: {
        expertise: string;
        verbosity: string;
    };
}): string;
//# sourceMappingURL=generation-v1.d.ts.map