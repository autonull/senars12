/**
 * The one projection of a bound table.
 *
 * Every knob in the system is bounded by a row of `{min, max, default, step}`, and every
 * reader of that row re-derived what it needed from it: a zod schema restating the two
 * limits, a tuner restating the range, a config default restating the landing value, a
 * clamp restating the arithmetic. Three tables (`narCoreBounds`, `cognitiveBounds`,
 * `systemOneBounds`) each shipped their own projector, and two of them declared the row's
 * own shape a second time — so a row had three types, and which one a call site meant was
 * a property of the table it happened to come from rather than of the row.
 *
 * A table now contributes only its numbers. A row has one shape, is addressed by one path
 * (`key`, or `category.key`), and every projection of it is named here.
 */
import { clamp } from '../utils/numeric.js';
import { z } from 'zod';

/** One knob's admissible numbers: the range, the landing value, and the scan quantum. */
export interface BoundRow {
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly step: number;
}

export type BoundProp = keyof BoundRow;

/**
 * `{min, max, default}` — what a surface that *picks* a value needs. `step` is deliberately
 * absent: it quantizes writes, it does not describe the search space.
 */
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
 * One row, addressed by path. Every read of a bound table is one of these, so "what may
 * this knob hold, and where does it land" has one answer per table rather than one per
 * caller.
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
      throw new Error(`Unknown bound: ${path}`);
    scope = (scope as Record<string, unknown>)[segment];
  }
  if (typeof scope !== 'object' || scope === null || typeof (scope as BoundRow).default !== 'number')
    throw new Error(`Unknown bound: ${path}`);
  return scope as BoundRow;
};

const project =
  <Path extends string>(resolve: (path: Path) => BoundRow): BoundProjection<Path> => ({
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

/** The whole flat table's landing values and schemas, keyed by row — the projections a
 *  config schema and a `DEFAULT_*` constant each used to re-derive row by row. */
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
    Object.fromEntries(paths.map((path) => [path, value(path)]));
  return {
    ...projection,
    defaults: byKey((path) => resolve(path).default),
    defaultsSchema: byKey((path) => projection.schema(path)),
  };
};

/** Projections for a table addressed by `category.key`. */
export const nestedBounds = <const T extends NestedBoundTable>(
  table: T
): BoundProjection<NestedBoundPath<T>> =>
  project((path) => rowAt(table, path));
