/**
 * reduction/index.js - Reduction module exports
 * Uses ReductionPipeline architecture (StepFunctions removed)
 */

// Re-export all from ReductionPipeline
export {
    ReductionPipeline,
    ReductionStage,
    CacheStage,
    JITStage,
    ZipperStage,
    GroundedOpStage,
    ExplicitCallStage,
    RuleMatchStage,
    SuperposeStage,
    PipelineBuilder
} from './ReductionPipeline.js';

// Re-export from JITCompiler
export {JITCompiler} from './JITCompiler.js';

// Note: Main reduction functions (reduce, reduceND, step, etc.) are exported from
// metta/src/kernel/Reduce.js which uses the pipeline architecture
