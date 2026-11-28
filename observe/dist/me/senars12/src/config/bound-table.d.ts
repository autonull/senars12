/**
 * Unified bound table system.
 *
 * Replaces cognitive-bounds.ts, nar-core-bounds.ts, system-one.ts bound tables.
 * Single source of truth for validation schemas, config defaults, and UI slider configs.
 */
import { z } from 'zod';
/** One knob's admissible numbers: the range, the landing value, and the scan quantum. */
export interface BoundRow {
    readonly min: number;
    readonly max: number;
    readonly default: number;
    readonly step: number;
}
export type BoundProp = keyof BoundRow;
/** `{min, max, default}` — what a surface that *picks* a value needs. */
export type BoundRange = Pick<BoundRow, 'min' | 'max' | 'default'>;
/** `{min, max, step}` — {@link BoundRange} for the surface that scans for one. */
export type BoundSpec = Pick<BoundRow, 'min' | 'max' | 'step'>;
/** A table of rows addressed by one segment: `key → row`. */
export type FlatBoundTable = Readonly<Record<string, BoundRow>>;
/** A table of rows addressed by two: `category → key → row`. */
export type NestedBoundTable = Readonly<Record<string, FlatBoundTable>>;
export type BoundTable = FlatBoundTable | NestedBoundTable;
/** `category.key` for every row of a {@link NestedBoundTable}. */
export type NestedBoundPath<T extends NestedBoundTable> = {
    [Category in keyof T & string]: `${Category}.${keyof T[Category] & string}`;
}[keyof T & string];
/** Whether a projected number accepts only integers. */
export interface BoundSchemaOptions {
    /** Reject non-integers — a knob that counts rather than rates. */
    readonly int?: boolean;
    /** Attach the row's own landing value. Defaults to yes. */
    readonly defaulted?: boolean;
}
/**
 * One row, addressed by path. Every read of a bound table is one of these.
 */
export interface BoundProjection<Path extends string> {
    /** One number out of one row. */
    at(path: Path, prop: BoundProp): number;
    /** The whole row. */
    row(path: Path): BoundRow;
    /** `{min, max, default}` — what a surface that picks a value needs. */
    range(path: Path): BoundRange;
    /** `{min, max, step}` — what a surface that scans for one needs. */
    spec(path: Path): BoundSpec;
    /** A zod number the row bounds, never restating a limit. */
    schema(path: Path, options?: BoundSchemaOptions): z.ZodType<number>;
    /** `value` snapped onto the row's step and clamped into its range. */
    quantize(path: Path, value: number): number;
}
/** The whole flat table's landing values and schemas, keyed by row. */
export type FlatBoundProjection<T extends FlatBoundTable> = BoundProjection<keyof T & string> & {
    readonly defaults: Record<keyof T & string, number>;
    readonly defaultsSchema: Record<keyof T & string, z.ZodType<number>>;
};
/** Projections for a table addressed by one segment. */
export declare const flatBounds: <const T extends FlatBoundTable>(table: T) => FlatBoundProjection<T>;
/** Projections for a table addressed by `category.key`. */
export declare const nestedBounds: <const T extends NestedBoundTable>(table: T) => BoundProjection<NestedBoundPath<T>>;
/**
 * Build a defaults object from a bound projection by reading every row's default value.
 *
 * @param projection - The bound projection from flatBounds() or nestedBounds()
 * @param paths - Array of paths to read defaults for (e.g., ['priority.initialPriority', 'lm.maxRulesPerCycle'])
 * @returns Object with the same nested structure as the paths, populated with defaults
 */
export declare function buildDefaultsFromBounds(projection: BoundProjection<string>, paths: readonly string[]): Record<string, unknown>;
/**
 * Validate a config object against a bound table's rows.
 * Returns an array of error messages (empty if valid).
 */
export declare function validateAgainstBounds(config: {
    [key: string]: unknown;
} | undefined, projection: BoundProjection<string>, prefix?: string): string[];
/**
 * Predefined bound tables for the system.
 */
export declare const boundTables: {
    /** Cognitive architecture parameters. */
    readonly cognitive: {
        readonly priority: {
            readonly initialPriority: {
                readonly min: 0.01;
                readonly max: 1;
                readonly default: 0.1;
                readonly step: 0.01;
            };
            readonly maxPriority: {
                readonly min: 0.5;
                readonly max: 2;
                readonly default: 1;
                readonly step: 0.1;
            };
            readonly directMentionBoost: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 0.3;
                readonly step: 0.05;
            };
            readonly relatedConceptBoost: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 0.15;
                readonly step: 0.05;
            };
            readonly decayRate: {
                readonly min: 0;
                readonly max: 0.5;
                readonly default: 0.05;
                readonly step: 0.01;
            };
            readonly propagationStrength: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 0.1;
                readonly step: 0.05;
            };
        };
        readonly lm: {
            readonly enabled: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 1;
                readonly step: 1;
            };
            readonly singlePremiseEnabled: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 1;
                readonly step: 1;
            };
            readonly maxRulesPerCycle: {
                readonly min: 1;
                readonly max: 20;
                readonly default: 13;
                readonly step: 1;
            };
            readonly callTimeoutMs: {
                readonly min: 500;
                readonly max: 60000;
                readonly default: 5000;
                readonly step: 500;
            };
            readonly selectionStrategy: {
                readonly min: 0;
                readonly max: 3;
                readonly default: 0;
                readonly step: 1;
            };
        };
        readonly attention: {
            readonly autoPrime: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 1;
                readonly step: 1;
            };
            readonly primeBoost: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 0.3;
                readonly step: 0.05;
            };
            readonly relatedBoost: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 0.15;
                readonly step: 0.05;
            };
            readonly structuralSimilarity: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 1;
                readonly step: 1;
            };
            readonly semanticRelatedness: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 0;
                readonly step: 1;
            };
            readonly propagateActivation: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 1;
                readonly step: 1;
            };
            readonly propagationIterations: {
                readonly min: 1;
                readonly max: 10;
                readonly default: 2;
                readonly step: 1;
            };
        };
        readonly inference: {
            readonly maxDerivationsPerStep: {
                readonly min: 10;
                readonly max: 10000;
                readonly default: 1000;
                readonly step: 10;
            };
            readonly maxDerivationDepth: {
                readonly min: 1;
                readonly max: 20;
                readonly default: 10;
                readonly step: 1;
            };
            readonly enableCircularDetection: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 1;
                readonly step: 1;
            };
            readonly enableTraceCollection: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 0;
                readonly step: 1;
            };
            readonly cpuThrottleMs: {
                readonly min: 0;
                readonly max: 100;
                readonly default: 0;
                readonly step: 1;
            };
            readonly maxSampledConcepts: {
                readonly min: 10;
                readonly max: 1000;
                readonly default: 100;
                readonly step: 10;
            };
            readonly rankingMaxAdmissions: {
                readonly min: 10;
                readonly max: 1000;
                readonly default: 100;
                readonly step: 10;
            };
            readonly rankingMinScore: {
                readonly min: 0;
                readonly max: 1;
                readonly default: 0;
                readonly step: 0.05;
            };
        };
        readonly modelRunner: {
            readonly maxLoops: {
                readonly min: 1;
                readonly max: 20;
                readonly default: 5;
                readonly step: 1;
            };
        };
        readonly memory: {
            readonly activationDecayRate: {
                readonly min: 0.001;
                readonly max: 0.5;
                readonly default: 0.01;
                readonly step: 0.001;
            };
        };
    };
    /** NAR core config parameters. */
    readonly narCore: {
        readonly maxConcepts: {
            readonly min: 100;
            readonly max: 10000;
            readonly default: 1000;
            readonly step: 100;
        };
        readonly activationDecayRate: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.01;
            readonly step: 0.001;
        };
        readonly consolidationInterval: {
            readonly min: 1;
            readonly max: 100;
            readonly default: 10;
            readonly step: 1;
        };
        readonly cpuThrottleMs: {
            readonly min: 0;
            readonly max: 100;
            readonly default: 10;
            readonly step: 1;
        };
        readonly maxDerivationDepth: {
            readonly min: 1;
            readonly max: 100;
            readonly default: 10;
            readonly step: 1;
        };
        readonly maxDerivationsPerStep: {
            readonly min: 10;
            readonly max: 10000;
            readonly default: 1000;
            readonly step: 10;
        };
        readonly sampleSize: {
            readonly min: 1;
            readonly max: 1000;
            readonly default: 100;
            readonly step: 1;
        };
    };
    /** System One config parameters. */
    readonly systemOne: {
        readonly budgets: {
            readonly maxJudgmentCallsPerCycle: {
                readonly min: 1;
                readonly max: 32;
                readonly default: 8;
                readonly step: 1;
            };
            readonly maxConsensusPerCycle: {
                readonly min: 1;
                readonly max: 8;
                readonly default: 2;
                readonly step: 1;
            };
            readonly maxLatencyMsPerJudgment: {
                readonly min: 10;
                readonly max: 200;
                readonly default: 33;
                readonly step: 1;
            };
            readonly maxTokensPerCycle: {
                readonly min: 256;
                readonly max: 32768;
                readonly default: 4096;
                readonly step: 256;
            };
            readonly maxMemoryMbPerCycle: {
                readonly min: 32;
                readonly max: 2048;
                readonly default: 256;
                readonly step: 32;
            };
        };
        readonly provisional: {
            readonly cInitial: {
                readonly min: 0.01;
                readonly max: 0.5;
                readonly default: 0.1;
                readonly step: 0.01;
            };
            readonly decayRate: {
                readonly min: 0.05;
                readonly max: 1;
                readonly default: 0.3;
                readonly step: 0.05;
            };
            readonly maxTtlMs: {
                readonly min: 5000;
                readonly max: 300000;
                readonly default: 30000;
                readonly step: 5000;
            };
        };
    };
};
export type CognitiveBounds = typeof boundTables.cognitive;
export type CognitiveBoundCategory = keyof CognitiveBounds;
export type NarCoreBounds = typeof boundTables.narCore;
export type NarCoreBoundKey = keyof NarCoreBounds;
export type SystemOneBounds = typeof boundTables.systemOne;
export type SystemOneBoundCategory = keyof SystemOneBounds;
export type SystemOneBoundKey<C extends SystemOneBoundCategory> = keyof SystemOneBounds[C];
export declare const cognitiveBound: BoundProjection<NestedBoundPath<{
    readonly priority: {
        readonly initialPriority: {
            readonly min: 0.01;
            readonly max: 1;
            readonly default: 0.1;
            readonly step: 0.01;
        };
        readonly maxPriority: {
            readonly min: 0.5;
            readonly max: 2;
            readonly default: 1;
            readonly step: 0.1;
        };
        readonly directMentionBoost: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.3;
            readonly step: 0.05;
        };
        readonly relatedConceptBoost: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.15;
            readonly step: 0.05;
        };
        readonly decayRate: {
            readonly min: 0;
            readonly max: 0.5;
            readonly default: 0.05;
            readonly step: 0.01;
        };
        readonly propagationStrength: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.1;
            readonly step: 0.05;
        };
    };
    readonly lm: {
        readonly enabled: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly singlePremiseEnabled: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly maxRulesPerCycle: {
            readonly min: 1;
            readonly max: 20;
            readonly default: 13;
            readonly step: 1;
        };
        readonly callTimeoutMs: {
            readonly min: 500;
            readonly max: 60000;
            readonly default: 5000;
            readonly step: 500;
        };
        readonly selectionStrategy: {
            readonly min: 0;
            readonly max: 3;
            readonly default: 0;
            readonly step: 1;
        };
    };
    readonly attention: {
        readonly autoPrime: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly primeBoost: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.3;
            readonly step: 0.05;
        };
        readonly relatedBoost: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.15;
            readonly step: 0.05;
        };
        readonly structuralSimilarity: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly semanticRelatedness: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0;
            readonly step: 1;
        };
        readonly propagateActivation: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly propagationIterations: {
            readonly min: 1;
            readonly max: 10;
            readonly default: 2;
            readonly step: 1;
        };
    };
    readonly inference: {
        readonly maxDerivationsPerStep: {
            readonly min: 10;
            readonly max: 10000;
            readonly default: 1000;
            readonly step: 10;
        };
        readonly maxDerivationDepth: {
            readonly min: 1;
            readonly max: 20;
            readonly default: 10;
            readonly step: 1;
        };
        readonly enableCircularDetection: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly enableTraceCollection: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0;
            readonly step: 1;
        };
        readonly cpuThrottleMs: {
            readonly min: 0;
            readonly max: 100;
            readonly default: 0;
            readonly step: 1;
        };
        readonly maxSampledConcepts: {
            readonly min: 10;
            readonly max: 1000;
            readonly default: 100;
            readonly step: 10;
        };
        readonly rankingMaxAdmissions: {
            readonly min: 10;
            readonly max: 1000;
            readonly default: 100;
            readonly step: 10;
        };
        readonly rankingMinScore: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0;
            readonly step: 0.05;
        };
    };
    readonly modelRunner: {
        readonly maxLoops: {
            readonly min: 1;
            readonly max: 20;
            readonly default: 5;
            readonly step: 1;
        };
    };
    readonly memory: {
        readonly activationDecayRate: {
            readonly min: 0.001;
            readonly max: 0.5;
            readonly default: 0.01;
            readonly step: 0.001;
        };
    };
}>>;
export declare const narCoreBound: FlatBoundProjection<{
    readonly maxConcepts: {
        readonly min: 100;
        readonly max: 10000;
        readonly default: 1000;
        readonly step: 100;
    };
    readonly activationDecayRate: {
        readonly min: 0;
        readonly max: 1;
        readonly default: 0.01;
        readonly step: 0.001;
    };
    readonly consolidationInterval: {
        readonly min: 1;
        readonly max: 100;
        readonly default: 10;
        readonly step: 1;
    };
    readonly cpuThrottleMs: {
        readonly min: 0;
        readonly max: 100;
        readonly default: 10;
        readonly step: 1;
    };
    readonly maxDerivationDepth: {
        readonly min: 1;
        readonly max: 100;
        readonly default: 10;
        readonly step: 1;
    };
    readonly maxDerivationsPerStep: {
        readonly min: 10;
        readonly max: 10000;
        readonly default: 1000;
        readonly step: 10;
    };
    readonly sampleSize: {
        readonly min: 1;
        readonly max: 1000;
        readonly default: 100;
        readonly step: 1;
    };
}>;
export declare const systemOneBound: BoundProjection<NestedBoundPath<{
    readonly budgets: {
        readonly maxJudgmentCallsPerCycle: {
            readonly min: 1;
            readonly max: 32;
            readonly default: 8;
            readonly step: 1;
        };
        readonly maxConsensusPerCycle: {
            readonly min: 1;
            readonly max: 8;
            readonly default: 2;
            readonly step: 1;
        };
        readonly maxLatencyMsPerJudgment: {
            readonly min: 10;
            readonly max: 200;
            readonly default: 33;
            readonly step: 1;
        };
        readonly maxTokensPerCycle: {
            readonly min: 256;
            readonly max: 32768;
            readonly default: 4096;
            readonly step: 256;
        };
        readonly maxMemoryMbPerCycle: {
            readonly min: 32;
            readonly max: 2048;
            readonly default: 256;
            readonly step: 32;
        };
    };
    readonly provisional: {
        readonly cInitial: {
            readonly min: 0.01;
            readonly max: 0.5;
            readonly default: 0.1;
            readonly step: 0.01;
        };
        readonly decayRate: {
            readonly min: 0.05;
            readonly max: 1;
            readonly default: 0.3;
            readonly step: 0.05;
        };
        readonly maxTtlMs: {
            readonly min: 5000;
            readonly max: 300000;
            readonly default: 30000;
            readonly step: 5000;
        };
    };
}>>;
export declare const COGNITIVE_DEFAULT_PATHS: readonly ['priority.initialPriority', 'priority.maxPriority', 'priority.directMentionBoost', 'priority.relatedConceptBoost', 'priority.decayRate', 'priority.propagationStrength', 'lm.maxRulesPerCycle', 'lm.callTimeoutMs', 'attention.primeBoost', 'attention.relatedBoost', 'attention.propagationIterations', 'inference.maxDerivationsPerStep', 'inference.maxDerivationDepth', 'inference.cpuThrottleMs', 'inference.maxSampledConcepts', 'inference.rankingMaxAdmissions', 'inference.rankingMinScore', 'modelRunner.maxLoops', 'memory.activationDecayRate'];
export declare const SYSTEM_ONE_DEFAULT_PATHS: readonly ['budgets.maxJudgmentCallsPerCycle', 'budgets.maxConsensusPerCycle', 'budgets.maxLatencyMsPerJudgment', 'budgets.maxTokensPerCycle', 'budgets.maxMemoryMbPerCycle', 'provisional.cInitial', 'provisional.decayRate', 'provisional.maxTtlMs'];
export declare const cognitiveBounds: {
    readonly priority: {
        readonly initialPriority: {
            readonly min: 0.01;
            readonly max: 1;
            readonly default: 0.1;
            readonly step: 0.01;
        };
        readonly maxPriority: {
            readonly min: 0.5;
            readonly max: 2;
            readonly default: 1;
            readonly step: 0.1;
        };
        readonly directMentionBoost: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.3;
            readonly step: 0.05;
        };
        readonly relatedConceptBoost: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.15;
            readonly step: 0.05;
        };
        readonly decayRate: {
            readonly min: 0;
            readonly max: 0.5;
            readonly default: 0.05;
            readonly step: 0.01;
        };
        readonly propagationStrength: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.1;
            readonly step: 0.05;
        };
    };
    readonly lm: {
        readonly enabled: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly singlePremiseEnabled: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly maxRulesPerCycle: {
            readonly min: 1;
            readonly max: 20;
            readonly default: 13;
            readonly step: 1;
        };
        readonly callTimeoutMs: {
            readonly min: 500;
            readonly max: 60000;
            readonly default: 5000;
            readonly step: 500;
        };
        readonly selectionStrategy: {
            readonly min: 0;
            readonly max: 3;
            readonly default: 0;
            readonly step: 1;
        };
    };
    readonly attention: {
        readonly autoPrime: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly primeBoost: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.3;
            readonly step: 0.05;
        };
        readonly relatedBoost: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0.15;
            readonly step: 0.05;
        };
        readonly structuralSimilarity: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly semanticRelatedness: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0;
            readonly step: 1;
        };
        readonly propagateActivation: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly propagationIterations: {
            readonly min: 1;
            readonly max: 10;
            readonly default: 2;
            readonly step: 1;
        };
    };
    readonly inference: {
        readonly maxDerivationsPerStep: {
            readonly min: 10;
            readonly max: 10000;
            readonly default: 1000;
            readonly step: 10;
        };
        readonly maxDerivationDepth: {
            readonly min: 1;
            readonly max: 20;
            readonly default: 10;
            readonly step: 1;
        };
        readonly enableCircularDetection: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 1;
            readonly step: 1;
        };
        readonly enableTraceCollection: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0;
            readonly step: 1;
        };
        readonly cpuThrottleMs: {
            readonly min: 0;
            readonly max: 100;
            readonly default: 0;
            readonly step: 1;
        };
        readonly maxSampledConcepts: {
            readonly min: 10;
            readonly max: 1000;
            readonly default: 100;
            readonly step: 10;
        };
        readonly rankingMaxAdmissions: {
            readonly min: 10;
            readonly max: 1000;
            readonly default: 100;
            readonly step: 10;
        };
        readonly rankingMinScore: {
            readonly min: 0;
            readonly max: 1;
            readonly default: 0;
            readonly step: 0.05;
        };
    };
    readonly modelRunner: {
        readonly maxLoops: {
            readonly min: 1;
            readonly max: 20;
            readonly default: 5;
            readonly step: 1;
        };
    };
    readonly memory: {
        readonly activationDecayRate: {
            readonly min: 0.001;
            readonly max: 0.5;
            readonly default: 0.01;
            readonly step: 0.001;
        };
    };
};
/**
 * NAR core config bounds — the single source of truth for engine defaults,
 * config-file schemas, and UI slider configs. Avoids drift between validation
 * limits, engine defaults and UI control ranges.
 */
/** A bound row's limits, never restated: `narCoreNumber('maxDerivationDepth')`. */
export declare const narCoreNumber: (key: NarCoreBoundKey) => z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
/** The same row carrying its default — what a config-file field wants. */
export declare const narCoreDefaultedNumber: (key: NarCoreBoundKey) => z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>;
/** Every bound's default, keyed by knob — the projection the engine's `DEFAULT_CONFIG`
 *  and the config-file schema's `narCoreDefaults` both wanted and each re-derived. */
export declare const narCoreDefaults: Record<NarCoreBoundKey, number>;
/** The whole table as one zod object, defaults attached — so the schema is the bounds
 *  rather than a hand-maintained transcription of them. */
export declare const narCoreDefaultsSchema: Record<"activationDecayRate" | "consolidationInterval" | "cpuThrottleMs" | "maxConcepts" | "maxDerivationDepth" | "maxDerivationsPerStep" | "sampleSize", z.ZodType<number, unknown, z.core.$ZodTypeInternals<number, unknown>>>;
export declare const narCoreBounds: {
    readonly maxConcepts: {
        readonly min: 100;
        readonly max: 10000;
        readonly default: 1000;
        readonly step: 100;
    };
    readonly activationDecayRate: {
        readonly min: 0;
        readonly max: 1;
        readonly default: 0.01;
        readonly step: 0.001;
    };
    readonly consolidationInterval: {
        readonly min: 1;
        readonly max: 100;
        readonly default: 10;
        readonly step: 1;
    };
    readonly cpuThrottleMs: {
        readonly min: 0;
        readonly max: 100;
        readonly default: 10;
        readonly step: 1;
    };
    readonly maxDerivationDepth: {
        readonly min: 1;
        readonly max: 100;
        readonly default: 10;
        readonly step: 1;
    };
    readonly maxDerivationsPerStep: {
        readonly min: 10;
        readonly max: 10000;
        readonly default: 1000;
        readonly step: 10;
    };
    readonly sampleSize: {
        readonly min: 1;
        readonly max: 1000;
        readonly default: 100;
        readonly step: 1;
    };
};
//# sourceMappingURL=bound-table.d.ts.map