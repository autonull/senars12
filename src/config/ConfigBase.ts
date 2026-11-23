/**
 * ConfigBase — single base class for all config schemas.
 *
 * Enforces: boundary primitives from `config/boundary.ts`, strict shape,
 * and provides generate-time helpers (TypeScript interfaces, JSON Schema,
 * Markdown docs, env docs, Zod runtime schemas).
 */
import { z } from 'zod';
import {
  nonEmpty,
  unitInterval,
  signedUnitInterval,
  uuid,
  nonNegativeInt,
  positiveInt,
  timestamp,
  intBetween,
  intAtLeast,
} from './boundary';

/** Re-export boundary primitives for convenience. */
export {
  nonEmpty,
  unitInterval,
  signedUnitInterval,
  uuid,
  nonNegativeInt,
  positiveInt,
  timestamp,
  intBetween,
  intAtLeast,
};

/**
 * Base class for configuration schemas.
 * All config schemas should extend this or use `ConfigBase.schema()`.
 */
export abstract class ConfigBase<Schema extends z.ZodRawShape> {
  /** Create a strict Zod object schema from a shape. */
  static schema<Shape extends z.ZodRawShape>(shape: Shape): z.ZodObject<Shape> {
    return z.object(shape).strict();
  }

  /** Validate config against a schema, throwing on failure. */
  static validate<T>(config: unknown, schema: z.ZodSchema<T>): T {
    return schema.parse(config);
  }

  /** Get default values from a schema (all fields optional or with defaults). */
  static defaults<T>(schema: z.ZodSchema<T>): T {
    return schema.parse({});
  }

  /** Create a partial version of a schema (all fields optional). */
  static partial<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>): z.ZodObject<{
    [K in keyof Shape]: z.ZodOptional<Shape[K]>;
  }> {
    return schema.partial();
  }

  /** Create a schema with only the given keys required. */
  static pick<Shape extends z.ZodRawShape, K extends keyof Shape>(
    schema: z.ZodObject<Shape>,
    keys: K[]
  ): z.ZodObject<Pick<Shape, K>> {
    return schema.pick(keys as any);
  }

  /** Create a schema omitting the given keys. */
  static omit(schema: z.ZodObject<any>, keys: readonly string[]): z.ZodObject<any> {
    return schema.omit(keys as any);
  }
}

/** Convenience type for configs that extend ConfigBase. */
export type ConfigSchema<T extends z.ZodRawShape> = z.ZodObject<T>;

/** Type inference helper. */
export type InferConfig<S extends z.ZodSchema<any>> = z.infer<S>;