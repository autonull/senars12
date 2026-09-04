/**
 * reduction/index.js - Reduction module exports
 * Uses ReductionPipeline architecture (StepFunctions removed)
 */

// Re-export from JITCompiler
export { JITCompiler } from './JITCompiler.js';
// Re-export all from ReductionPipeline
export {
  CacheStage,
  ExplicitCallStage,
  GroundedOpStage,
  JITStage,
  PipelineBuilder,
  ReductionPipeline,
  ReductionStage,
  RuleMatchStage,
  SuperposeStage,
  ZipperStage,
} from './ReductionPipeline.js';

// Note: Main reduction functions (reduce, reduceND, step, etc.) are exported from
// metta/src/kernel/Reduce.js which uses the pipeline architecture
