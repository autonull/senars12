/**
 * Unified builder infrastructure.
 *
 * Provides a shared base for all fluent builders:
 * - NARBuilder (agent/builder.ts)
 * - BookBuilder (admit/book.ts)
 * - MeTTaBuilder (metta/runtime/builder.ts)
 */

import { FluentBuilderMixin, type FluentBuilder, type BuilderConfig, type BuilderStep } from '../fluent-builder';

export { FluentBuilderMixin, type FluentBuilder, type BuilderConfig, type BuilderStep } from '../fluent-builder';

/**
 * Standard step record for builders.
 */
export interface BuilderStepRecord {
  step: string;
  present: boolean;
  detail?: Record<string, unknown>;
}

/** Internal mixin instance type. */
type MixinInstance<Config, Step> = InstanceType<ReturnType<typeof FluentBuilderMixin<Config, Step>>>;

/**
 * Base builder class with common functionality.
 *
 * Uses composition over inheritance to wrap the FluentBuilderMixin.
 * Subclasses implement:
 * - `Config` - the final built object type
 * - `Step` - step recording type (extends BuilderStepRecord)
 * - `build()` - construct the final object
 * - `validate()` - optional validation before build
 */
export abstract class BaseBuilder<Config, Step extends BuilderStepRecord = BuilderStepRecord> {
  protected readonly _mixin: MixinInstance<Config, Step>;
  protected readonly _steps: Step[] = [];

  constructor() {
    this._mixin = new (FluentBuilderMixin<Config, Step>())();
  }

  /** Record a configuration step. */
  protected recordStep(step: string, present: boolean, detail?: Record<string, unknown>): this {
    this._steps.push({ step, present, detail } as Step);
    this._mixin.recordStep(step, present, detail);
    return this;
  }

  /** Get recorded steps (read-only). */
  getSteps(): ReadonlyArray<Step> {
    return this._steps;
  }

  /** Validate before build. Override in subclasses. */
  protected validate(): void {
    // No-op by default
  }

  /** Build the final configuration object. */
  abstract build(): Config | Promise<Config>;

  /** Build with validation. */
  buildValidated(): Config | Promise<Config> {
    this.validate();
    return this.build();
  }
}

/**
 * Builder factory for creating builder instances.
 */
export interface BuilderFactory<Config, Builder extends BaseBuilder<Config, any>> {
  create(): Builder;
}

/**
 * Create a builder factory for a builder class.
 */
export function createBuilderFactory<Config, Builder extends BaseBuilder<Config, any>>(
  BuilderClass: new () => Builder
): BuilderFactory<Config, Builder> {
  return {
    create: () => new BuilderClass(),
  };
}

/**
 * Typed step helper for compile-time step validation.
 */
export type ValidStep<T extends BaseBuilder<any, any>> =
  T extends BaseBuilder<any, infer Step> ? Step['step'] : never;

/**
 * Step validation result.
 */
export interface StepValidationResult {
  valid: boolean;
  missing: string[];
  unexpected: string[];
}

/**
 * Validate that required steps are present.
 */
export function validateSteps<T extends BaseBuilder<any, any>>(
  builder: T,
  requiredSteps: string[]
): StepValidationResult {
  const presentSteps = new Set(builder.getSteps().map(s => s.step));
  const missing = requiredSteps.filter(step => !presentSteps.has(step));
  const unexpected = builder.getSteps()
    .filter(s => !requiredSteps.includes(s.step))
    .map(s => s.step);

  return {
    valid: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected,
  };
}