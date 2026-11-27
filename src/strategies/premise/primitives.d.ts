import type { Concept } from '../../memory/concept';
import type { MemoryView } from '../../memory/view';
import type { Task } from '../../types';
import type { TermTruth } from '../../types/truth';
export type PremiseSource = (task: Task, memory: MemoryView, n?: number) => Concept[];
export type PremiseScorer = (task: Task, concept: Concept) => number;
export type PremiseScorerFactory = (memory: MemoryView) => PremiseScorer;
export type PremiseFilter = (task: Task, concept: Concept) => boolean;
export type PremiseFilterFactory = (...args: unknown[]) => PremiseFilter;
export declare const PREMISE_SOURCES: {
    readonly bag: (task: Task, memory: MemoryView, n?: number) => Concept[];
    readonly concepts: (task: Task, memory: MemoryView) => Concept[];
    readonly links: (task: Task, memory: MemoryView, n?: number) => Concept[];
    readonly taskArgs: (task: Task, memory: MemoryView) => Concept[];
    readonly graph: (task: Task, memory: MemoryView, n?: number) => Concept[];
};
export declare const PREMISE_SCORER_REGISTRY: {
    readonly priority: {
        readonly create: (_memory: MemoryView) => PremiseScorer;
        readonly isExtended: false;
    };
    readonly linkWeight: {
        readonly create: (memory: MemoryView) => PremiseScorer;
        readonly isExtended: false;
    };
    readonly edgeWeight: {
        readonly create: (memory: MemoryView) => PremiseScorer;
        readonly isExtended: false;
    };
    readonly linear: {
        readonly create: (_memory: MemoryView, weights: LinearWeights) => ((memory: MemoryView) => PremiseScorer);
        readonly isExtended: true;
    };
};
export declare const PREMISE_FILTER_REGISTRY: {
    readonly sharedAtoms: {
        readonly create: () => PremiseFilter;
        readonly isCurried: false;
    };
    readonly noStampOverlap: {
        readonly create: () => PremiseFilter;
        readonly isCurried: false;
    };
    readonly inheritanceOnly: {
        readonly create: () => PremiseFilter;
        readonly isCurried: false;
    };
    readonly inheritanceOverlap: {
        readonly create: () => PremiseFilter;
        readonly isCurried: false;
    };
    readonly highConfidence: {
        readonly create: (threshold: number) => PremiseFilter;
        readonly isCurried: true;
    };
};
export type ScorerName = keyof typeof PREMISE_SCORER_REGISTRY;
export type FilterName = keyof typeof PREMISE_FILTER_REGISTRY;
/** A filter name, or a parameterized curried filter spec. */
export type FilterSpec = FilterName | {
    highConfidence: number;
};
/** Registry-derived, never hand-written: adding a source/scorer widens the config automatically. */
export type SourceName = keyof typeof PREMISE_SOURCES;
export interface LinearWeights {
    link: number;
    embed: number;
    pri: number;
}
export interface SampleConfig {
    source?: SourceName;
    scorer?: ScorerName | {
        linear: LinearWeights;
    };
    filters?: FilterSpec[];
    minScore?: number;
    sampleSize: number;
    limit: number;
    skipSameTerm?: boolean;
    /** Escape hatch for one-off predicates; composed with `filters`, never replaces them. */
    where?: (task: Task, concept: Concept) => boolean;
    /** Escape hatch for truth-value predicates. */
    whereTruth?: (task: Task, truth: TermTruth) => boolean;
}
/**
 * `SampleConfig` with every defaulted field resolved. The two escape hatches
 * keep their optionality: they have no default, and a pipeline that declared
 * one would be inventing a predicate the caller never wrote.
 */
export type ResolvedSampleConfig = Required<Omit<SampleConfig, 'scorer' | 'where' | 'whereTruth'>> & {
    scorer: NonNullable<SampleConfig['scorer']>;
} & Pick<SampleConfig, 'where' | 'whereTruth'>;
/**
 * The sampling pipeline a primitive inherits when it declares no value of its
 * own. The configuration schema's defaults read from here, so the table, the
 * singletons and a user config all resolve to the same pipeline.
 */
export declare const PREMISE_SAMPLE_FALLBACK: ResolvedSampleConfig;
/**
 * The scorer for a sample config, or `undefined` when the caller asked for none.
 *
 * A name that is *present but unresolvable* throws rather than degrading: an
 * unknown scorer used to yield `undefined`, which `samplePremisesFromConfig`
 * turned into an empty premise set — a strategy that silently stopped
 * contributing. `linear` is curried and has no bare spelling, so naming it
 * without weights is a mistake worth reporting.
 */
export declare function resolveScorer(memory: MemoryView, scorer: SampleConfig['scorer']): PremiseScorer | undefined;
export declare function samplePremisesFromConfig(memory: MemoryView, task: Task, config: SampleConfig): Task[];
//# sourceMappingURL=primitives.d.ts.map