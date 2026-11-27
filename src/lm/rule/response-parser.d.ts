import type { Term } from '../../terms';
import type { Truth as TruthType } from '../../terms/impls/Truth';
import type { TermTruth } from '../../types/truth';
export interface ParsedLMResponse {
    term: Term;
    truth: TruthType;
    confidence?: number;
    raw: string;
    valid: boolean;
    error?: string;
}
export interface StructuredLMOutput {
    narsese: string;
    truth?: TermTruth;
    confidence?: number;
}
export declare const LMResponseParser: {
    parse(response: string): ParsedLMResponse;
    validate(response: string): ParsedLMResponse;
};
//# sourceMappingURL=response-parser.d.ts.map