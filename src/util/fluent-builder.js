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
export function FluentBuilderMixin() {
    return class {
        steps = [];
        recordStep(step, present, detail) {
            this.steps.push({ step, present, detail });
            return this;
        }
        getSteps() {
            return this.steps;
        }
        build() {
            throw new Error('build() must be implemented by subclass');
        }
    };
}
