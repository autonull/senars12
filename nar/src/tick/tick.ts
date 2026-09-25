import type { Budget, Task, Term, TruthType } from '../types/core.js';
import { dispatch, type Middleware, passthrough } from '@senars/util';

export interface AIKRBudget {
  cycles: number;
  depth?: number;
}

export interface CognitiveEvent {
  tickId: string;
  stage: string;
  detail?: string;
  at: number;
}

export interface ToolOutcome {
  tool: string;
  success: boolean;
}

export interface TickState {
  perceptions: Task[];
  memories: Task[];
  proposals: Task[];
  derivations: Task[];
  actions: Task[];
  outcomes: ToolOutcome[];
}

export interface TickContext {
  tickId: string;
  budget: AIKRBudget;
  focusId?: string;
  events: CognitiveEvent[];
  state: TickState;
}

export type TickMiddleware = Middleware<TickContext>;

const emit = (ctx: TickContext, stage: string, detail?: string): void => {
  ctx.events.push({ tickId: ctx.tickId, stage, detail, at: Date.now() });
};

export type TickHook = (ctx: TickContext) => void | Promise<void>;

export interface TickHooks {
  perceive?: TickHook;
  recall?: TickHook;
  attend?: TickHook;
  reason?: TickHook;
  propose?: TickHook;
  negotiate?: TickHook;
  authorize?: TickHook;
  act?: TickHook;
  validate?: TickHook;
  learn?: TickHook;
  consolidate?: TickHook;
}

export const createTickPipeline = (hooks: TickHooks = {}): TickMiddleware[] => {
  const stage =
    (name: keyof TickHooks): TickMiddleware =>
    async (ctx, next) => {
      emit(ctx, name);
      await hooks[name]?.(ctx);
      await next();
    };
  return [
    stage('perceive'),
    stage('recall'),
    stage('attend'),
    stage('reason'),
    stage('propose'),
    stage('negotiate'),
    stage('authorize'),
    stage('act'),
    stage('validate'),
    stage('learn'),
    stage('consolidate'),
  ];
};

/**
 * @deprecated since 1.x — use `createTickPipeline`.
 * Kept per the 2-minor deprecation lifecycle (REFACTOR.todo1 Phase A).
 */
export const createPipeline: typeof createTickPipeline = createTickPipeline;

const emitTick = (ctx: TickContext, stage: string): void => {
  emit(ctx, stage);
};

export const perceiveMiddleware = passthrough('perceive', emitTick);
export const recallMiddleware = passthrough('recall', emitTick);
export const attendMiddleware = passthrough('attend', emitTick);
export const reasonMiddleware = passthrough('reason', emitTick);
export const proposeMiddleware = passthrough('propose', emitTick);
export const negotiateMiddleware = passthrough('negotiate', emitTick);
export const authorizeMiddleware = passthrough('authorize', emitTick);
export const actMiddleware = passthrough('act', emitTick);
export const validateMiddleware = passthrough('validate', emitTick);
export const learnMiddleware = passthrough('learn', emitTick);
export const consolidateMiddleware = passthrough('consolidate', emitTick);

export const DEFAULT_PIPELINE: TickMiddleware[] = [
  perceiveMiddleware,
  recallMiddleware,
  attendMiddleware,
  reasonMiddleware,
  proposeMiddleware,
  negotiateMiddleware,
  authorizeMiddleware,
  actMiddleware,
  validateMiddleware,
  learnMiddleware,
  consolidateMiddleware,
];

export const createTickContext = (
  tickId: string,
  budget: AIKRBudget,
  focusId?: string
): TickContext => ({
  tickId,
  budget,
  focusId,
  events: [],
  state: {
    perceptions: [],
    memories: [],
    proposals: [],
    derivations: [],
    actions: [],
    outcomes: [],
  },
});

export async function runTick(
  ctx: TickContext,
  pipeline: TickMiddleware[] = DEFAULT_PIPELINE
): Promise<TickContext> {
  await dispatch(pipeline, ctx);
  return ctx;
}

export type { Budget, Task, Term, TruthType };
