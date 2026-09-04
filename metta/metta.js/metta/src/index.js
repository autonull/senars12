/**
 * metta/src/index.js - Main export entry point
 */

export { ConfigManager, createMeTTaConfig, Validators } from './config/ConfigManager.js';
export { ExtensionRegistry, registerMeTTaExtensions } from './config/ExtensionRegistry.js';
// Configuration exports
export { configManager, getConfig } from './config.js';
// Extension exports
export { NeuralBridge } from './extensions/NeuralBridge.js';
export { PersistentSpace } from './extensions/PersistentSpace.js';
export { SMTBridge } from './extensions/SMTOps.js';
export { VisualDebugger, visualDebugger } from './extensions/VisualDebugger.js';
export { Ground } from './kernel/Ground.js';
export { compileIL, ILEmit, ILLower, ILNode, ILOpt } from './kernel/MeTTaIL.js';
export { AlgebraicOps } from './kernel/ops/AlgebraicOps.js';
export { ParallelExecutor } from './kernel/ParallelExecutor.js';
export { PathTrie } from './kernel/PathTrie.js';
export { JITCompiler } from './kernel/reduction/JITCompiler.js';
export {
  CacheStage,
  ExplicitCallStage,
  GroundedOpStage,
  JITStage,
  ReductionPipeline,
  ReductionStage,
  RuleMatchStage,
  SuperposeStage,
  ZipperStage,
} from './kernel/reduction/ReductionPipeline.js';
export { Space } from './kernel/Space.js';
// Kernel exports
export * from './kernel/Term.js';
export { Unify } from './kernel/Unify.js';
export { Zipper } from './kernel/Zipper.js';
// Ergonomic API (recommended for new code)
export {
  createMeTTa,
  createWithPreset,
  evaluate,
  MeTTaBuilder,
  MeTTaSession,
  Presets,
  runInContext,
} from './MeTTa.js';
// Core interpreter (legacy API)
export { MeTTaInterpreter } from './MeTTaInterpreter.js';
export { Parser } from './Parser.js';
export { loadStdlib } from './stdlib/StdlibLoader.js';
export { TypeSystem } from './TypeSystem.js';
