import { createBudget, createTask } from '../types/core.js';
import type { Task } from '../types/core.js';
import { getPredicate, getSubject, isAtomic, isInheritance } from '../terms/index.js';
import type { TickContext, TickHook } from './tick.js';
import type { LMBackend, ProvisionalBelief } from '../stream/reasoner.js';

export type Maybe<T> = T | Promise<T>;

export interface FirewallLike {
  check(narsese: string, kind?: 'belief' | 'goal' | 'question'): { allowed: boolean; reason?: string };
}

export interface ConceptLike {
  term: Parameters<typeof createTask>[0];
  priority: number;
  beliefBag: { peek(): { truth: Parameters<typeof createTask>[2] } | undefined };
}

export interface MemoryLike {
  sample(limit: number): ConceptLike[];
}

export interface FocusLike {
  id: string;
  step(budget: number): Promise<{ tasksProcessed: number; derivations: number } & Record<string, unknown>>;
}

export interface FocusBagLike {
  allocateBudget(focus: FocusLike, totalBudget: number): number;
}

export interface ActionProposalLike {
  action: string;
  args?: Record<string, unknown>;
  value: number;
  confidence: number;
  source: string;
}

export interface NALDerivationLike {
  action: string;
  truth: { f: number; c: number };
  source: string;
}

export interface NegotiationDecisionLike {
  action: string | null;
  actionExecuted: string | null;
  vetoedBy: string | null;
}

export interface NegotiatorLike {
  resolve(proposals: ActionProposalLike[], derivations: NALDerivationLike[]): NegotiationDecisionLike;
}

export interface PolicyLike {
  checkCommand(command: string): { allowed: boolean; reason?: string };
}

export interface ToolsLike {
  execute(name: string, args: Record<string, unknown>): Promise<{ success: boolean; error?: unknown }>;
}

export interface ValidatorLike {
  check(ctx: TickContext): Maybe<{ ok: boolean; reason?: string }>;
}

export interface TaskOutcomeLike {
  taskType: 'test' | 'scenario' | 'contradiction' | 'schema' | 'capability' | 'knob_tune' | 'meta_reasoning';
  success: boolean;
  metrics: Record<string, number>;
}

export interface RLFPLike {
  calculateRewardFromTask(outcome: TaskOutcomeLike): number;
}

export interface TickDeps {
  stimuli?: () => Maybe<Task[]>;
  firewall?: FirewallLike;
  memory?: MemoryLike;
  focus?: FocusLike;
  focusBag?: FocusBagLike;
  proposers?: Array<(ctx: TickContext) => Maybe<Task[]>>;
  negotiator?: NegotiatorLike;
  policy?: PolicyLike;
  tools?: ToolsLike;
  actionOf?: (task: Task) => { name: string; args: Record<string, unknown> } | undefined;
  validator?: ValidatorLike;
  rewardOf?: (ctx: TickContext) => number;
  rlfp?: RLFPLike;
  taskOutcomeOf?: (ctx: TickContext) => TaskOutcomeLike;
  intrinsicOf?: (ctx: TickContext) => Record<string, number>;
  onReward?: (reward: number, ctx: TickContext) => void;
  decayers?: Array<{ decay(rate?: number): void }>;
  decayRate?: number;
  reasoner?: { flush(backend: LMBackend, pressure: number): Promise<ProvisionalBelief[]> };
  pressureOf?: () => number;
  lmBackend?: LMBackend;
}

export const operationActionOf = (task: Task): { name: string; args: Record<string, unknown> } | undefined => {
  if (!isInheritance(task.term)) return undefined;
  const predicate = getPredicate(task.term);
  if (!predicate || !isAtomic(predicate) || !predicate.symbol.startsWith('^')) return undefined;
  const subject = getSubject(task.term);
  const args = subject?.kind === 'product' ? (subject.args?.map(String) ?? []) : subject ? [String(subject)] : [];
  return { name: predicate.symbol.slice(1), args: { args } };
};

const actionKey = (task: Task, actionOf: NonNullable<TickDeps['actionOf']>): string =>
  actionOf(task)?.name ?? String(task.term);

export function createDefaultHooks(deps: TickDeps): Record<string, TickHook> {
  const actionOf = deps.actionOf ?? operationActionOf;
  return {
    perceive: async (ctx) => {
      const incoming = (await deps.stimuli?.()) ?? [];
      for (const task of incoming) {
        const verdict = deps.firewall?.check(String(task.term), task.type);
        if (verdict && !verdict.allowed) {
          ctx.events.push({ tickId: ctx.tickId, stage: 'perceive', detail: `blocked: ${verdict.reason}`, at: Date.now() });
          continue;
        }
        ctx.state.perceptions.push(task);
      }
    },
    recall: async (ctx) => {
      const concepts = deps.memory?.sample(ctx.budget.cycles) ?? [];
      for (const c of concepts) {
        const truth = c.beliefBag.peek()?.truth;
        if (truth) ctx.state.memories.push(createTask(c.term, 'belief', truth, createBudget(c.priority)));
      }
    },
    attend: async (ctx) => {
      if (deps.focusBag && deps.focus) ctx.budget.cycles = deps.focusBag.allocateBudget(deps.focus, ctx.budget.cycles);
      if (deps.focus) {
        const report = await deps.focus.step(ctx.budget.cycles);
        ctx.events.push({ tickId: ctx.tickId, stage: 'attend', detail: `focus:${deps.focus.id} tasks=${report.tasksProcessed}`, at: Date.now() });
      }
    },
    propose: async (ctx) => {
      for (const propose of deps.proposers ?? []) ctx.state.proposals.push(...(await propose(ctx)));
    },
    reason: async (ctx) => {
      if (deps.reasoner && deps.lmBackend) {
        const settled = await deps.reasoner.flush(deps.lmBackend, deps.pressureOf?.() ?? 0);
        for (const prov of settled) ctx.state.derivations.push(prov as unknown as Task);
      }
    },
    negotiate: async (ctx) => {
      if (!deps.negotiator) return;
      const proposals: ActionProposalLike[] = ctx.state.proposals
        .filter((t) => t.type === 'goal')
        .map((t) => ({ action: actionKey(t, actionOf), value: t.budget.priority, confidence: t.truth.c, source: 'tick' }));
      const derivations: NALDerivationLike[] = ctx.state.derivations.map((t) => ({
        action: String((t as Task).term ?? t),
        truth: (t as Task).truth ?? { f: 0.5, c: 0 },
        source: 'tick',
      }));
      const decision = deps.negotiator.resolve(proposals, derivations);
      const executed = decision.actionExecuted ?? (decision.vetoedBy ? null : decision.action);
      if (decision.vetoedBy) {
        ctx.events.push({ tickId: ctx.tickId, stage: 'negotiate', detail: `veto:${decision.vetoedBy}`, at: Date.now() });
        return;
      }
      const winner = ctx.state.proposals.find((t) => t.type === 'goal' && actionKey(t, actionOf) === executed);
      if (winner) ctx.state.actions.push(winner);
    },
    authorize: async (ctx) => {
      if (!deps.policy) return;
      ctx.state.actions = ctx.state.actions.filter((task) => {
        const verdict = deps.policy!.checkCommand(actionKey(task, actionOf));
        if (!verdict.allowed)
          ctx.events.push({ tickId: ctx.tickId, stage: 'authorize', detail: `denied: ${verdict.reason}`, at: Date.now() });
        return verdict.allowed;
      });
    },
    act: async (ctx) => {
      if (!deps.tools) return;
      for (const task of ctx.state.actions) {
        const op = actionOf(task);
        if (!op) continue;
        const result = await deps.tools.execute(op.name, op.args);
        ctx.state.outcomes.push({ tool: op.name, success: result.success });
        ctx.events.push({
          tickId: ctx.tickId, stage: 'act',
          detail: `${op.name}:${result.success ? 'ok' : `fail:${String(result.error ?? 'unknown')}`}`,
          at: Date.now(),
        });
      }
    },
    validate: async (ctx) => {
      if (!deps.validator) return;
      const verdict = await deps.validator.check(ctx);
      if (!verdict.ok) {
        ctx.state.outcomes.length = 0;
        ctx.events.push({ tickId: ctx.tickId, stage: 'validate', detail: `quarantined: ${verdict.reason ?? 'shadow check failed'}`, at: Date.now() });
      }
    },
    learn: async (ctx) => {
      const outcomes = ctx.state.outcomes;
      const passRate = outcomes.length === 0 ? 0 : outcomes.filter((o) => o.success).length / outcomes.length;
      const reward = deps.rewardOf?.(ctx) ?? (deps.rlfp
        ? deps.rlfp.calculateRewardFromTask(deps.taskOutcomeOf?.(ctx) ?? {
          taskType: 'meta_reasoning',
          success: passRate === 1 && outcomes.length > 0,
          metrics: { passRate, ...deps.intrinsicOf?.(ctx) },
        })
        : passRate);
      deps.onReward?.(reward, ctx);
      ctx.events.push({ tickId: ctx.tickId, stage: 'learn', detail: `reward:${reward.toFixed(3)}`, at: Date.now() });
    },
    consolidate: async (ctx) => {
      for (const bag of deps.decayers ?? []) bag.decay(deps.decayRate);
      ctx.state.perceptions.length = 0;
    },
  };
}
