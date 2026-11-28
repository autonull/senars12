/**
 * Formalization Oracle — wraps the formalizer through the oracle seam.
 *
 * This makes the formalizer capability available as a faculty via the oracle system.
 */
import type { Oracle, OracleInput, OracleOutput, OracleConfig } from './oracle';
import { type PerceivedInterpretation } from '../nl/formalizer';
import type { ILMService } from '../lm/interfaces';
import type { GenerationInput, GenerationOutput } from '../nl/generation';
import type { NLContext } from '../nl/understanding';
/** Input for nlToFormal oracle call. */
export interface NLToFormalInput extends OracleInput {
    operation: 'formalization.nlToFormal';
    args: [text: string, ctx?: NLContext];
}
/** Input for formalToNl oracle call. */
export interface FormalToNlInput extends OracleInput {
    operation: 'formalization.formalToNl';
    args: [input: GenerationInput];
}
/** Formalization oracle configuration. */
export interface FormalizationOracleConfig extends OracleConfig {
    operation: 'formalization.nlToFormal' | 'formalization.formalToNl';
    lmService: ILMService | null | undefined;
}
/** Formalization oracle implementation. */
export declare class FormalizationOracle implements Oracle<NLToFormalInput | FormalToNlInput, PerceivedInterpretation | GenerationOutput> {
    readonly operation: 'formalization.nlToFormal' | 'formalization.formalToNl';
    readonly provider: string;
    readonly version?: string;
    private readonly formalizer;
    constructor(config: FormalizationOracleConfig);
    call(input: NLToFormalInput | FormalToNlInput): Promise<OracleOutput<PerceivedInterpretation | GenerationOutput>>;
    isAvailable(): Promise<boolean>;
    setPinStore(_store: any): void;
    getStats(): {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        pinnedCalls: number;
        totalDurationMs: number;
    };
}
/** Create a formalization oracle for nlToFormal. */
export declare function createNLToFormalOracle(lmService: ILMService | null | undefined, config?: Partial<Omit<FormalizationOracleConfig, 'operation' | 'lmService'>>): FormalizationOracle;
/** Create a formalization oracle for formalToNl. */
export declare function createFormalToNlOracle(lmService: ILMService | null | undefined, config?: Partial<Omit<FormalizationOracleConfig, 'operation' | 'lmService'>>): FormalizationOracle;
/** Register both formalization oracles with the registry. */
export declare function registerFormalizationOracles(lmService: ILMService | null | undefined): FormalizationOracle[];
//# sourceMappingURL=formalization.d.ts.map