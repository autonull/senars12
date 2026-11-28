import type { TermTruth } from '../../types/truth';
export interface RankableDerivation {
    term: {
        toString(): string;
    };
    truth?: TermTruth | null;
}
export interface RankingOptions {
    maxAdmissions?: number;
    minScore?: number;
}
export declare const DEFAULT_MAX_ADMISSIONS = 100;
export declare const DEFAULT_MIN_SCORE = 0;
export declare function scoreDerivation(termString: string, f: number, c: number): number;
export declare function rankDerivations<T extends RankableDerivation>(results: T[], opts?: RankingOptions): T[];
//# sourceMappingURL=ranking.d.ts.map