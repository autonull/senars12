/**
 * Builder infrastructure — unified fluent builder pattern.
 */

export {
  BaseBuilder,
  type BuilderStepRecord,
  type BuilderFactory,
  createBuilderFactory,
  type ValidStep,
  type StepValidationResult,
  validateSteps,
} from './base';

// Re-export fluent-builder types
export { FluentBuilderMixin, type FluentBuilder, type BuilderConfig, type BuilderStep } from '../fluent-builder';