import type { Budget, Task, Term, TruthType } from '../types/core.js';

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

export type TickMiddleware = (ctx: TickContext, next: () => Promise<void>) => Promise<void>;

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

const passthrough = (stage: string): TickMiddleware => async (ctx, next) => {
  emit(ctx, stage);
  await next();
};

export const createPipeline = (hooks: TickHooks = {}): TickMiddleware[] => {
  const stage = (name: keyof TickHooks): TickMiddleware => async (ctx, next) => {
    emit(ctx, name);
    await hooks[name]?.(ctx);
    await next();
  };
  return [
    stage('perceive'), stage('recall'), stage('attend'), stage('reason'),
    stage('propose'), stage('negotiate'), stage('authorize'), stage('act'),
    stage('validate'), stage('learn'), stage('consolidate'),
  ];
};

export const perceiveMiddleware = passthrough('perceive');
export const recallMiddleware = passthrough('recall');
export const attendMiddleware = passthrough('attend');
export const reasonMiddleware = passthrough('reason');
export const proposeMiddleware = passthrough('propose');
export const negotiateMiddleware = passthrough('negotiate');
export const authorizeMiddleware = passthrough('authorize');
export const actMiddleware = passthrough('act');
export const validateMiddleware = passthrough('validate');
export const learnMiddleware = passthrough('learn');
export const consolidateMiddleware = passthrough('consolidate');

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

export const createTickContext = (tickId: string, budget: AIKRBudget, focusId?: string): TickContext => ({
  tickId,
  budget,
  focusId,
  events: [],
  state: { perceptions: [], memories: [], proposals: [], derivations: [], actions: [], outcomes: [] },
});

export async function runTick(ctx: TickContext, pipeline: TickMiddleware[] = DEFAULT_PIPELINE): Promise<TickContext> {
  let index = -1;
  const dispatch = async (i: number): Promise<void> => {
    if (i <= index) throw new Error('next() called multiple times');
    index = i;
    await pipeline[i]?.(ctx, () => dispatch(i + 1));
  };
  await dispatch(0);
  return ctx;
}

export type { Budget, Task, Term, TruthType };
