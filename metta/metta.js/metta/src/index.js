/**
 * metta/src/index.js - Main export entry point
 */

// Ergonomic API (recommended for new code)
export {
  createMeTTa,
  MeTTaBuilder,
  evaluate,
  runInContext,
  MeTTaSession,
  Presets,
  createWithPreset,
} from './MeTTa.js';

// Core interpreter (legacy API)
export { MeTTaInterpreter } from './MeTTaInterpreter.js';
export { Parser } from './Parser.js';
export { TypeSystem } from './TypeSystem.js';
export { loadStdlib } from './stdlib/StdlibLoader.js';

// Kernel exports
export * from './kernel/Term.js';
export { Space } from './kernel/Space.js';
export { Ground } from './kernel/Ground.js';
export { Unify } from './kernel/Unify.js';
export { Zipper } from './kernel/Zipper.js';
export { PathTrie } from './kernel/PathTrie.js';
export { JITCompiler } from './kernel/reduction/JITCompiler.js';
export { ParallelExecutor } from './kernel/ParallelExecutor.js';
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
} from './kernel/reduction/ReductionPipeline.js';
export { ILNode, ILLower, ILOpt, ILEmit, compileIL } from './kernel/MeTTaIL.js';
export { AlgebraicOps } from './kernel/ops/AlgebraicOps.js';

// Extension exports
export { NeuralBridge } from './extensions/NeuralBridge.js';
export { PersistentSpace } from './extensions/PersistentSpace.js';
export { SMTBridge } from './extensions/SMTOps.js';
export { VisualDebugger, visualDebugger } from './extensions/VisualDebugger.js';

// Configuration exports
export { configManager, getConfig } from './config.js';
export { ConfigManager, createMeTTaConfig, Validators } from './config/ConfigManager.js';
export { ExtensionRegistry, registerMeTTaExtensions } from './config/ExtensionRegistry.js';
