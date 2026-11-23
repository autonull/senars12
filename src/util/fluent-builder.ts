/**
 * Shared fluent builder infrastructure.
 *
 * Provides a minimal base for the fluent builder pattern used across the codebase:
 * - NARBuilder (agent/builder.ts)
 * - BookBuilder (admit/book.ts)
 * - MeTTaBuilder (metta/runtime/builder.ts)
 * - And others
 *
 * Each builder subclass defines:
 * - `Config` - the final built object type
 * - `Step` - optional step recording type
 * - `recordStep(step, present, detail?)` - called by with* methods
 */

export interface FluentBuilder<Config, Step = never> {
  /** Record a configuration step (optional). */
  recordStep(step: string, present: boolean, detail?: Record<string, unknown>): this;
  /** Build the final configuration object. */
  build(): Config | Promise<Config>;
}

/**
 * Mixin that adds fluent builder capabilities to a class.
 *
 * Usage:
 * ```ts
 * class MyBuilder extends FluentBuilderMixin<MyConfig, MyStep>() {
 *   private config = { ...defaults };
 *
 *   withOption(value: string): this {
 *     this.config.option = value;
 *     return this.recordStep('option', true, { value });
 *   }
 *
 *   build(): MyConfig {
 *     return this.config;
 *   }
 * }
 * ```
 */
export function FluentBuilderMixin<Config, Step = never>() {
  return class implements FluentBuilder<Config, Step> {
    protected steps: Array<{ step: string; present: boolean; detail?: Record<string, unknown> }> = [];

    recordStep(step: string, present: boolean, detail?: Record<string, unknown>): this {
      this.steps.push({ step, present, detail });
      return this;
    }

    getSteps(): ReadonlyArray<{ step: string; present: boolean; detail?: Record<string, unknown> }> {
      return this.steps;
    }

    build(): Config | Promise<Config> {
      throw new Error('build() must be implemented by subclass');
    }
  };
}

/**
 * Type helper to extract the config type from a builder class.
 */
export type BuilderConfig<T> = T extends FluentBuilder<infer Config> ? Config : never;

/**
 * Type helper to extract the step type from a builder class.
 */
export type BuilderStep<T> = T extends FluentBuilder<any, infer Step> ? Step : never;