/**
 * The premise primitives' configuration surface, as a zod shape (TODO27 §11.4).
 *
 * `PREMISE_PRIMITIVES` declares *what* a primitive samples from, scores with and
 * filters on; this module projects the three registries behind those fields into
 * validated enums, so the knobs are user-configurable and a typo'd scorer is a
 * validation error at the boundary rather than a strategy that silently returns
 * zero premises. The names are read off the registries — adding a source, scorer
 * or filter widens the schema automatically.
 */
import { z } from 'zod';
import { type FilterName, type FilterSpec, type LinearWeights, type ScorerName, type SourceName } from './primitives';
export declare const PREMISE_SOURCE_NAMES: SourceName[];
/** Every filter name, curried ones included: a bare `highConfidence` uses its declared default. */
export declare const PREMISE_FILTER_NAMES: FilterName[];
/** Scorers with a bare spelling; `linear` is curried and has none. */
export declare const PREMISE_SCORER_NAMES: ScorerName[];
/** The sampling pipeline a primitive exposes, minus the two size knobs. */
export interface PremiseSampleSpec {
    source?: SourceName;
    scorer?: ScorerName | {
        linear: LinearWeights;
    };
    filters?: FilterSpec[];
    minScore?: number;
    skipSameTerm?: boolean;
}
/** The overrides `createPremiseStrategy` accepts; size knobs are required, the rest optional. */
export type PremiseOverrides = PremiseSampleSpec & {
    sampleSize: number;
    limit: number;
};
/**
 * The zod shape for one primitive: the table entry is the default, so a
 * configured variant and the exported singleton can never drift.
 */
export declare const premiseSampleShape: (spec: PremiseSampleSpec & {
    sampleSize: number;
    limit: number;
}) => z.ZodRawShape;
//# sourceMappingURL=config.d.ts.map