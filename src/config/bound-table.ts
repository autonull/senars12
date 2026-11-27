/**
 * Unified bound table system.
 *
 * Replaces cognitive-bounds.ts, nar-core-bounds.ts, system-one.ts bound tables.
 * Single source of truth for validation schemas, config defaults, and UI slider configs.
 */

import { z } from 'zod';
import { clamp } from '../util/numeric';
import { keyedBy } from '../util/collections';
import { SenarsError } from '../errors/senars-error';

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

const rowAt = (table: BoundTable, path: string): BoundRow => {
  let scope: unknown = table;
  for (const segment of path.split('.')) {
    if (typeof scope !== 'object' || scope === null || !(segment in scope))
      throw new SenarsError(`Unknown bound: ${path}`, 'VALIDATION_ERROR');
    scope = (scope as Record<string, unknown>)[segment];
  }
  if (
    typeof scope !== 'object' ||
    scope === null ||
    typeof (scope as BoundRow).default !== 'number'
  )
    throw new SenarsError(`Unknown bound: ${path}`, 'VALIDATION_ERROR');
  return scope as BoundRow;
};

const project = <Path extends string>(
  resolve: (path: Path) => BoundRow
): BoundProjection<Path> => ({
  at: (path, prop) => resolve(path)[prop],
  row: resolve,
  range: (path) => {
    const { min, max, default: value } = resolve(path);
    return { min, max, default: value };
  },
  spec: (path) => {
    const { min, max, step } = resolve(path);
    return { min, max, step };
  },
  schema: (path, { int = false, defaulted = true } = {}) => {
    const row = resolve(path);
    const bounded = z.number().min(row.min).max(row.max);
    const typed = int ? bounded.int() : bounded;
    return defaulted ? typed.default(row.default) : typed;
  },
  quantize: (path, value) => {
    const row = resolve(path);
    return clamp(Math.round(value / row.step) * row.step, row.min, row.max);
  },
});

/** The whole flat table's landing values and schemas, keyed by row. */
export type FlatBoundProjection<T extends FlatBoundTable> = BoundProjection<keyof T & string> & {
  readonly defaults: Record<keyof T & string, number>;
  readonly defaultsSchema: Record<keyof T & string, z.ZodType<number>>;
};

/** Projections for a table addressed by one segment. */
export const flatBounds = <const T extends FlatBoundTable>(table: T): FlatBoundProjection<T> => {
  const resolve = (path: keyof T & string) => rowAt(table, path);
  const projection = project(resolve);
  const paths = Object.keys(table) as (keyof T & string)[];
  const byKey = <V>(value: (path: keyof T & string) => V): Record<string, V> =>
    keyedBy(paths, (path) => path, value);
  return {
    ...projection,
    defaults: byKey((path) => resolve(path).default),
    defaultsSchema: byKey((path) => projection.schema(path)),
  };
};

/** Projections for a table addressed by `category.key`. */
export const nestedBounds = <const T extends NestedBoundTable>(
  table: T
): BoundProjection<NestedBoundPath<T>> => project((path) => rowAt(table, path));

/**
 * Build a defaults object from a bound projection by reading every row's default value.
 *
 * @param projection - The bound projection from flatBounds() or nestedBounds()
 * @param paths - Array of paths to read defaults for (e.g., ['priority.initialPriority', 'lm.maxRulesPerCycle'])
 * @returns Object with the same nested structure as the paths, populated with defaults
 */
export function buildDefaultsFromBounds(
  projection: BoundProjection<string>,
  paths: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const path of paths) {
    const value = projection.at(path, 'default');
    setNested(result, path, value);
  }
  return result;
}

/**
 * Set a nested value in an object using dot-notation path.
 */
function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

/**
 * Validate a config object against a bound table's rows.
 * Returns an array of error messages (empty if valid).
 */
export function validateAgainstBounds(
  config: { [key: string]: unknown } | undefined,
  projection: BoundProjection<string>,
  prefix = ''
): string[] {
  if (!config) return [];
  const errors: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'number') {
      try {
        const row = projection.row(path);
        if (value < row.min || value > row.max) {
          errors.push(`${path} must be in [${row.min}, ${row.max}], got ${value}`);
        }
      } catch {
        // Path not in bounds table - skip validation for this key
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      errors.push(...validateAgainstBounds(value as { [key: string]: unknown }, projection, path));
    }
  }
  return errors;
}

/**
 * Predefined bound tables for the system.
 */
export const boundTables = {
  /** Cognitive architecture parameters. */
  cognitive: {
    priority: {
      initialPriority: { min: 0.01, max: 1.0, default: 0.1, step: 0.01 },
      maxPriority: { min: 0.5, max: 2.0, default: 1.0, step: 0.1 },
      directMentionBoost: { min: 0.0, max: 1.0, default: 0.3, step: 0.05 },
      relatedConceptBoost: { min: 0.0, max: 1.0, default: 0.15, step: 0.05 },
      decayRate: { min: 0.0, max: 0.5, default: 0.05, step: 0.01 },
      propagationStrength: { min: 0.0, max: 1.0, default: 0.1, step: 0.05 },
    },
    lm: {
      enabled: { min: 0, max: 1, default: 1, step: 1 },
      singlePremiseEnabled: { min: 0, max: 1, default: 1, step: 1 },
      maxRulesPerCycle: { min: 1, max: 20, default: 13, step: 1 },
      callTimeoutMs: { min: 500, max: 60000, default: 5000, step: 500 },
      selectionStrategy: { min: 0, max: 3, default: 0, step: 1 },
    },
    attention: {
      autoPrime: { min: 0, max: 1, default: 1, step: 1 },
      primeBoost: { min: 0.0, max: 1.0, default: 0.3, step: 0.05 },
      relatedBoost: { min: 0.0, max: 1.0, default: 0.15, step: 0.05 },
      structuralSimilarity: { min: 0, max: 1, default: 1, step: 1 },
      semanticRelatedness: { min: 0, max: 1, default: 0, step: 1 },
      propagateActivation: { min: 0, max: 1, default: 1, step: 1 },
      propagationIterations: { min: 1, max: 10, default: 2, step: 1 },
    },
    inference: {
      maxDerivationsPerStep: { min: 10, max: 10000, default: 1000, step: 10 },
      maxDerivationDepth: { min: 1, max: 20, default: 10, step: 1 },
      enableCircularDetection: { min: 0, max: 1, default: 1, step: 1 },
      enableTraceCollection: { min: 0, max: 1, default: 0, step: 1 },
      cpuThrottleMs: { min: 0, max: 100, default: 0, step: 1 },
      maxSampledConcepts: { min: 10, max: 1000, default: 100, step: 10 },
      rankingMaxAdmissions: { min: 10, max: 1000, default: 100, step: 10 },
      rankingMinScore: { min: 0.0, max: 1.0, default: 0.0, step: 0.05 },
    },
    modelRunner: {
      maxLoops: { min: 1, max: 20, default: 5, step: 1 },
    },
    memory: {
      activationDecayRate: { min: 0.001, max: 0.5, default: 0.01, step: 0.001 },
    },
  } as const,

  /** NAR core config parameters. */
  narCore: {
    maxConcepts: { min: 100, max: 10000, default: 1000, step: 100 },
    activationDecayRate: { min: 0, max: 1, default: 0.01, step: 0.001 },
    consolidationInterval: { min: 1, max: 100, default: 10, step: 1 },
    cpuThrottleMs: { min: 0, max: 100, default: 10, step: 1 },
    maxDerivationDepth: { min: 1, max: 100, default: 10, step: 1 },
    maxDerivationsPerStep: { min: 10, max: 10000, default: 1000, step: 10 },
    sampleSize: { min: 1, max: 1000, default: 100, step: 1 },
  } as const,

  /** System One config parameters. */
  systemOne: {
    budgets: {
      maxJudgmentCallsPerCycle: { min: 1, max: 32, default: 8, step: 1 },
      maxConsensusPerCycle: { min: 1, max: 8, default: 2, step: 1 },
      maxLatencyMsPerJudgment: { min: 10, max: 200, default: 33, step: 1 },
      maxTokensPerCycle: { min: 256, max: 32768, default: 4096, step: 256 },
      maxMemoryMbPerCycle: { min: 32, max: 2048, default: 256, step: 32 },
    },
    provisional: {
      cInitial: { min: 0.01, max: 0.5, default: 0.1, step: 0.01 },
      decayRate: { min: 0.05, max: 1.0, default: 0.3, step: 0.05 },
      maxTtlMs: { min: 5000, max: 300000, default: 30000, step: 5000 },
    },
  } as const,
} as const;

// Type exports for convenience
export type CognitiveBounds = typeof boundTables.cognitive;
export type CognitiveBoundCategory = keyof CognitiveBounds;

export type NarCoreBounds = typeof boundTables.narCore;
export type NarCoreBoundKey = keyof NarCoreBounds;

export type SystemOneBounds = typeof boundTables.systemOne;
export type SystemOneBoundCategory = keyof SystemOneBounds;
export type SystemOneBoundKey<C extends SystemOneBoundCategory> = keyof SystemOneBounds[C];

// Pre-built projections for convenience
export const cognitiveBound = nestedBounds(boundTables.cognitive);
export const narCoreBound = flatBounds(boundTables.narCore);
export const systemOneBound = nestedBounds(boundTables.systemOne);

// Default paths for each table
export const COGNITIVE_DEFAULT_PATHS = [
  'priority.initialPriority',
  'priority.maxPriority',
  'priority.directMentionBoost',
  'priority.relatedConceptBoost',
  'priority.decayRate',
  'priority.propagationStrength',
  'lm.maxRulesPerCycle',
  'lm.callTimeoutMs',
  'attention.primeBoost',
  'attention.relatedBoost',
  'attention.propagationIterations',
  'inference.maxDerivationsPerStep',
  'inference.maxDerivationDepth',
  'inference.cpuThrottleMs',
  'inference.maxSampledConcepts',
  'inference.rankingMaxAdmissions',
  'inference.rankingMinScore',
  'modelRunner.maxLoops',
  'memory.activationDecayRate',
] as const;

export const SYSTEM_ONE_DEFAULT_PATHS = [
  'budgets.maxJudgmentCallsPerCycle',
  'budgets.maxConsensusPerCycle',
  'budgets.maxLatencyMsPerJudgment',
  'budgets.maxTokensPerCycle',
  'budgets.maxMemoryMbPerCycle',
  'provisional.cInitial',
  'provisional.decayRate',
  'provisional.maxTtlMs',
] as const;

// Re-export raw tables for backward compatibility
export const cognitiveBounds = boundTables.cognitive;

/**
 * NAR core config bounds — the single source of truth for engine defaults,
 * config-file schemas, and UI slider configs. Avoids drift between validation
 * limits, engine defaults and UI control ranges.
 */

/** A bound row's limits, never restated: `narCoreNumber('maxDerivationDepth')`. */
export const narCoreNumber = (key: NarCoreBoundKey) => narCoreBound.schema(key, { defaulted: false });

/** The same row carrying its default — what a config-file field wants. */
export const narCoreDefaultedNumber = (key: NarCoreBoundKey) => narCoreBound.schema(key);

/** Every bound's default, keyed by knob — the projection the engine's `DEFAULT_CONFIG`
 *  and the config-file schema's `narCoreDefaults` both wanted and each re-derived. */
export const narCoreDefaults: Record<NarCoreBoundKey, number> = narCoreBound.defaults;

/** The whole table as one zod object, defaults attached — so the schema is the bounds
 *  rather than a hand-maintained transcription of them. */
export const narCoreDefaultsSchema = narCoreBound.defaultsSchema;

// Re-export the raw table for any consumers that need it
export const narCoreBounds = boundTables.narCore;