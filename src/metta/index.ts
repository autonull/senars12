/**
 * MeTTa — MeTTa port and agent (migrated from @senars/metta and @senars/core/metta-port).
 */

export { createMeTTa, parseMeTTa, bootstrapStdLib, clearOps, defineOp, getOp, hasOp, registerOp, type GroundedOp, MettaEngine, MeTTaInterpreter, EGraph, PatternMatcher, ReductionPipeline, InMemorySpace, Stamp as MettaStamp, MeTTaBuilder, MeTTaRuntime, createMeTTa as createMetta, parseMeTTa as parseMetta } from '@senars/metta';
export type { MettaPort } from '@senars/core/metta-port';
export { createMettaPort } from '@senars/metta/agent';