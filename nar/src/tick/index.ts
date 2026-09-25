export type { CognitiveStage, OtelConfig } from '../otel/index.js';
export {
  emitSpanEvent,
  getTracer,
  initOtel,
  instrumentPipeline,
  recordCognitiveEvents,
  shutdownOtel,
  wrapMiddlewareWithSpan,
} from '../otel/index.js';
export type {
  FocusBagLike,
  FocusLike,
  MemoryLike,
  NegotiatorLike,
  PolicyLike,
  RLFPLike,
  TaskOutcomeLike,
  TickDeps,
  ToolsLike,
  ValidatorLike,
} from './bindings.js';
export { createDefaultHooks, operationActionOf } from './bindings.js';
export { toCognitiveEvents } from './bridge.js';
export type {
  AIKRBudget,
  CognitiveEvent,
  TickContext,
  TickHook,
  TickHooks,
  TickMiddleware,
  TickState,
  ToolOutcome,
} from './tick.js';
export {
  // Phase F (audit M6): the `@deprecated` createPipeline alias no longer
  // re-exports from the barrel; consumers import createTickPipeline directly.
  createTickContext,
  createTickPipeline,
  DEFAULT_PIPELINE,
  runTick,
} from './tick.js';
