/**
 * Unified builder infrastructure.
 *
 * Provides a shared base for all fluent builders:
 * - NARBuilder (agent/builder.ts)
 * - BookBuilder (admit/book.ts)
 * - MeTTaBuilder (metta/runtime/builder.ts)
 */
import { FluentBuilderMixin } from '../fluent-builder';
export { FluentBuilderMixin } from '../fluent-builder';
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
export class BaseBuilder {
    _mixin;
    _steps = [];
    constructor() {
        this._mixin = new (FluentBuilderMixin())();
    }
    /** Record a configuration step. */
    recordStep(step, present, detail) {
        this._steps.push({ step, present, detail });
        this._mixin.recordStep(step, present, detail);
        return this;
    }
    /** Get recorded steps (read-only). */
    getSteps() {
        return this._steps;
    }
    /** Validate before build. Override in subclasses. */
    validate() {
        // No-op by default
    }
    /** Build with validation. */
    buildValidated() {
        this.validate();
        return this.build();
    }
}
/**
 * Create a builder factory for a builder class.
 */
export function createBuilderFactory(BuilderClass) {
    return {
        create: () => new BuilderClass(),
    };
}
/**
 * Validate that required steps are present.
 */
export function validateSteps(builder, requiredSteps) {
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
