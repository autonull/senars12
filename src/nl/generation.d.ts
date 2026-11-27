import type { ILMService } from '../lm/interfaces';
import type { BeliefInfo, DerivationTrace, ConflictInfo } from './types';
export type { BeliefInfo, DerivationTrace, ConflictInfo } from './types';
export interface GenerationInput {
    query: string;
    derivation: DerivationTrace | null;
    beliefs: BeliefInfo[];
    conflicts: ConflictInfo[];
    userProfile?: {
        expertise: 'lay' | 'technical';
        verbosity: 'concise' | 'detailed';
    };
}
export interface GenerationOutput {
    response: string;
    confidence: number;
    suggestedFollowups: string[];
    meta: {
        reasoningType: string;
        keyPremises: string[];
        gaps: string[];
    };
}
export declare class NLGenerationService {
    private readonly lm;
    private readonly flight;
    constructor(lm: ILMService | null);
    generate(input: GenerationInput): Promise<GenerationOutput>;
    private generateInner;
    private fallbackGenerate;
}
//# sourceMappingURL=generation.d.ts.map