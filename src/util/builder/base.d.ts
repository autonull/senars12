/**
 * Unified builder infrastructure.
 *
 * Provides a shared base for all fluent builders:
 * - NARBuilder (agent/builder.ts)
 * - BookBuilder (admit/book.ts)
 * - MeTTaBuilder (metta/runtime/builder.ts)
 */
import { FluentBuilderMixin } from '../fluent-builder';
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
export declare abstract class BaseBuilder<Config, Step extends BuilderStepRecord = BuilderStepRecord> {
    protected readonly _mixin: MixinInstance<Config, Step>;
    protected readonly _steps: Step[];
    constructor();
    /** Record a configuration step. */
    protected recordStep(step: string, present: boolean, detail?: Record<string, unknown>): this;
    /** Get recorded steps (read-only). */
    getSteps(): ReadonlyArray<Step>;
    /** Validate before build. Override in subclasses. */
    protected validate(): void;
    /** Build the final configuration object. */
    abstract build(): Config | Promise<Config>;
    /** Build with validation. */
    buildValidated(): Config | Promise<Config>;
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
export declare function createBuilderFactory<Config, Builder extends BaseBuilder<Config, any>>(BuilderClass: new () => Builder): BuilderFactory<Config, Builder>;
/**
 * Typed step helper for compile-time step validation.
 */
export type ValidStep<T extends BaseBuilder<any, any>> = T extends BaseBuilder<any, infer Step> ? Step['step'] : never;
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
export declare function validateSteps<T extends BaseBuilder<any, any>>(builder: T, requiredSteps: string[]): StepValidationResult;
//# sourceMappingURL=base.d.ts.map