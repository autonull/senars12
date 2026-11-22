/**
 * Loop Iteration — core iteration execution logic.
 */

import type { LoopContext, IterationResult, ActionResult, SelectionResult, SelectionContext, SelectionCandidate, EconomyTask, LoopEventType } from './types';
import type { Economy, EconomyScheduler, SchedulerResult } from '../economy/index';
import type { FacultyInvoker } from './types';
import type { Oracle } from '../oracles/oracle';
import type { ContractRegistry, ContractCheckResult, ContractContext } from './contract';
import type { RepairLoop, RepairContext, RepairResult as LoopRepairResult } from './repair';
import type { LoopAppraisal } from './appraise';
import type { LoopRecorder } from './record';
import type { SelfModelManager } from './self-model';
import { defaultLoopConfig } from './types';

/** Runs a single loop iteration. */
export async function runIteration(
  context: LoopContext,
  invokers: Map<string, FacultyInvoker>,
  emit: (type: LoopEventType, data: Record<string, unknown>) => void
): Promise<IterationResult> {
  const startTs = context.env.clock.now();
  const iteration = context.iteration;

  emit('iteration_start', { iteration });

  // 1. Schedule task from economy
  const scheduleResult = context.scheduler.schedule();
  emit('selection_made', { iteration, taskId: scheduleResult.task?.id });

  if (!scheduleResult.task) {
    return createEmptyResult(iteration, 'No task scheduled');
  }

  // 2. Build selection context and select action
  const selectionContext = buildSelectionContext(context, scheduleResult);
  const selection = await context.selector.select(selectionContext);

  // 3. Execute actions for selected task
  const actions = await executeActions(context, invokers, selection.selected, scheduleResult.task, emit);

  // 4. Run judgments
  const judgments = await runJudgments(scheduleResult.task, actions);

  // 5. Check contracts
  const contracts = await checkContracts(context, scheduleResult.task, actions);

  // 6. Run repair if needed
  const repairs = await runRepairs(context, scheduleResult.task, actions, contracts);

  // 7. Appraise iteration
  const appraisal = await appraiseIteration(context, scheduleResult.task, actions, judgments, contracts, repairs);

  // 8. Update self-model
  if (context.selfModel && appraisal) {
    context.selfModel.updateFromAppraisal(appraisal);
  }

  // 9. Record iteration
  if (context.recorder) {
    await recordIteration(context, scheduleResult.task, selection, actions, judgments, contracts, repairs, appraisal);
  }

  // 10. Tick self-model
  if (context.selfModel) {
    context.selfModel.tick();
  }

  const durationMs = context.env.clock.now() - startTs;

  const result: IterationResult = {
    iteration,
    selectedTask: scheduleResult.task,
    selection,
    actions,
    judgments,
    contracts,
    repairs,
    appraisal,
    durationMs,
    success: actions.every(a => a.success) && contracts.every(c => c.passed),
  };

  emit('iteration_complete', { iteration, durationMs, success: result.success });
  return result;
}

/** Builds selection context from economy state. */
function buildSelectionContext(context: LoopContext, scheduleResult: SchedulerResult): SelectionContext {
  const tasks = context.economy.getAllTasks();
  const beliefs = tasks.filter(t => t.kind === 'belief');
  const goals = tasks.filter(t => t.kind === 'goal');

  const candidates: SelectionCandidate[] = scheduleResult.candidates.map(c => ({
    id: c.task.id,
    action: c.task as unknown as import('../kernel/types').Task,
    utility: c.utility,
    voi: 0,
    confidence: c.task.truth.c,
    sourceFaculty: 'economy',
    evidence: [],
    cost: 1,
    risk: 0,
    priority: c.task.weight,
  }));

  return {
    candidates,
    beliefs: beliefs as unknown as import('../kernel/types').Task[],
    goals: goals as unknown as import('../kernel/types').Task[],
    budget: scheduleResult.metadata.budgetRemaining,
    urgency: 0.5,
    riskTolerance: 0.5,
    iteration: context.iteration,
    history: [],
  };
}

/** Executes actions for a selected task. */
async function executeActions(
  context: LoopContext,
  invokers: Map<string, FacultyInvoker>,
  selected: SelectionCandidate | null,
  scheduledTask: EconomyTask,
  emit: (type: LoopEventType, data: Record<string, unknown>) => void
): Promise<ActionResult[]> {
  if (!selected) return [];

  const task = context.economy.getTask(selected.id) ?? scheduledTask;
  const results: ActionResult[] = [];

  // Try faculty invokers
  for (const [name, invoker] of invokers) {
    if (taskMatchesFaculty(task, invoker.spec)) {
      const actionStart = context.env.clock.now();
      try {
        const input = {
          faculty: invoker.spec.name,
          primary: task.term,
          context: { truth: task.truth },
          budget: 10,
          priority: task.weight,
        } satisfies import('../faculties/specs').FacultyInput;

        const output = await invoker.invoke(input);
        const durationMs = context.env.clock.now() - actionStart;

        results.push({
          actionId: `faculty-${name}-${task.id}`,
          task,
          success: true,
          output,
          effects: convertFacultyOutput(output),
          durationMs,
        });

        emit('action_executed', { iteration: context.iteration, faculty: name, taskId: task.id });
      } catch (error) {
        results.push({
          actionId: `faculty-${name}-${task.id}`,
          task,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          effects: [],
          durationMs: context.env.clock.now() - actionStart,
        });
      }
    }
  }

  // If no faculty handled it, try oracle
  if (results.length === 0) {
    const oraclesMap = (context.oracles as unknown as { oracles: Map<string, Oracle> }).oracles;
    for (const [op, oracle] of oraclesMap) {
      if (taskMatchesOracle(task, oracle)) {
        const actionStart = context.env.clock.now();

        try {
          const output = await oracle.call({ operation: oracle.operation, args: [task.term] });
          const durationMs = context.env.clock.now() - actionStart;

          results.push({
            actionId: `oracle-${op}-${task.id}`,
            task,
            success: true,
            output,
            effects: convertOracleOutput(output),
            durationMs,
          });

          emit('action_executed', { iteration: context.iteration, oracle: op, taskId: task.id });
          break; // Only one oracle per task
        } catch (error) {
          results.push({
            actionId: `oracle-${op}-${task.id}`,
            task,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            effects: [],
            durationMs: context.env.clock.now() - actionStart,
          });
        }
      }
    }
  }

  return results;
}

/** Checks if task matches faculty spec. */
function taskMatchesFaculty(task: EconomyTask, spec: import('../faculties/specs').FacultySpec): boolean {
  const taskStr = task.term.toString().toLowerCase();
  return task.tags.includes(spec.category) ||
         taskStr.includes(spec.name) ||
         (spec.name === 'grounding' && task.kind === 'belief') ||
         (spec.name === 'inference' && task.kind === 'goal') ||
         (spec.name === 'planning' && task.kind === 'plan');
}

/** Checks if task matches oracle. */
function taskMatchesOracle(task: EconomyTask, oracle: Oracle): boolean {
  const taskStr = task.term.toString().toLowerCase();
  return taskStr.includes(oracle.operation.toLowerCase());
}

/** Converts faculty output to effects. */
function convertFacultyOutput<T>(_output: import('../faculties/specs').FacultyOutput<T>): import('./types').EffectResult[] {
  return [];
}

/** Converts oracle output to effects. */
function convertOracleOutput<T>(_output: import('../oracles/oracle').OracleOutput<T>): import('./types').EffectResult[] {
  return [];
}

/** Runs judgments on task and actions. */
async function runJudgments(
  task: EconomyTask,
  actions: ActionResult[]
): Promise<import('./types').JudgmentResult[]> {
  return [{
    judgmentId: `judgment-${task.id}`,
    task,
    score: actions.every(a => a.success) ? 0.8 : 0.3,
    confidence: 0.7,
    details: { actions: actions.length, successes: actions.filter(a => a.success).length },
  }];
}

/** Checks contracts. */
async function checkContracts(
  context: LoopContext,
  task: EconomyTask,
  actions: ActionResult[]
): Promise<ContractCheckResult[]> {
  if (!context.contracts || !context.config.contractsEnabled) return [];

  const contractContext: ContractContext = {
    iteration: context.iteration,
    currentTask: task as unknown as import('../kernel/types').Task,
    focusBag: context.economy.getAllTasks() as unknown as import('../kernel/types').Task[],
    beliefs: context.economy.getTasksByKind('belief') as unknown as import('../kernel/types').Task[],
    goals: context.economy.getTasksByKind('goal') as unknown as import('../kernel/types').Task[],
    selectedAction: task as unknown as import('../kernel/types').Task,
    oracleCalls: [],
    resources: { tokensUsed: 0, tokensRemaining: 1000, wallTimeMs: 0, cpuTimeMs: 0 },
    clock: context.env.clock,
  };

  const { checkContracts: checkContractsFn } = await import('./contract');
  return checkContractsFn(contractContext);
}

/** Runs repairs. */
async function runRepairs(
  context: LoopContext,
  task: EconomyTask,
  actions: ActionResult[],
  contracts: ContractCheckResult[]
): Promise<LoopRepairResult[]> {
  if (!context.repair || !context.config.repairEnabled) return [];

  const failedContracts = contracts.filter(c => !c.passed);
  if (failedContracts.length === 0) return [];

  const repairContext: RepairContext = {
    iteration: context.iteration,
    recentTasks: [],
    beliefs: context.economy.getTasksByKind('belief') as unknown as import('../kernel/types').Task[],
    goals: context.economy.getTasksByKind('goal') as unknown as import('../kernel/types').Task[],
    resources: { cpu: 0, memory: 0, tokensUsed: 0, tokensRemaining: 1000, wallTimeMs: 0 },
    oracleHealth: [],
    gateStates: [],
    clock: context.env.clock,
  };

  return context.repair.tick(repairContext);
}

/** Appraises iteration. */
async function appraiseIteration(
  context: LoopContext,
  task: EconomyTask,
  actions: ActionResult[],
  judgments: import('./types').JudgmentResult[],
  contracts: ContractCheckResult[],
  repairs: LoopRepairResult[]
): Promise<LoopAppraisal | undefined> {
  if (!context.config.appraisalEnabled) return undefined;

  const success = actions.every(a => a.success);
  const overallScore = success ? 0.8 : 0.4;

  return {
    iteration: context.iteration,
    timestamp: context.env.clock.now(),
    overallScore,
    dimensions: [
      { dimension: 'effectiveness', score: success ? 1.0 : 0.5, confidence: 0.8, evidence: [], trend: 'stable' },
      { dimension: 'coherence', score: judgments[0]?.score ?? 0.5, confidence: 0.7, evidence: [], trend: 'stable' },
      { dimension: 'safety', score: contracts.every(c => c.passed) ? 1.0 : 0.3, confidence: 0.8, evidence: [], trend: 'stable' },
    ],
    summary: success ? 'All actions succeeded' : 'Some actions failed',
    recommendations: [],
  };
}

/** Records iteration. */
async function recordIteration(
  context: LoopContext,
  task: EconomyTask,
  selection: SelectionResult,
  actions: ActionResult[],
  judgments: import('./types').JudgmentResult[],
  contracts: ContractCheckResult[],
  repairs: LoopRepairResult[],
  appraisal?: LoopAppraisal
): Promise<void> {
  if (!context.recorder) return;

  const now = context.env.clock.now();
  const iteration = context.iteration;
  const correlationId = context.correlationId;

  const contractRecords = contracts.map((c, i) => ({
    type: 'contract' as const,
    id: context.env.ids.uuid(),
    iteration,
    timestamp: now,
    correlationId,
    payload: {
      contractId: c.contractId,
      contractType: 'basic',
      passed: c.passed,
      severity: c.severity,
      message: c.message,
    },
  }));

  const outcome: 'success' | 'failure' | 'partial' = actions.every(a => a.success) ? 'success' : actions.some(a => a.success) ? 'partial' : 'failure';

  const payload = {
    task: task as unknown as import('../kernel/types').Task,
    action: task as unknown as import('../kernel/types').Task,
    outcome,
    durationMs: actions.reduce((sum, a) => sum + a.durationMs, 0),
    resources: {
      tokensUsed: 0,
      oracleCalls: actions.filter(a => a.actionId.startsWith('oracle')).length,
      facultyCalls: actions.filter(a => a.actionId.startsWith('faculty')).length,
    },
    contracts: contractRecords,
  };

  await context.recorder.recordIteration(payload);
}

/** Creates empty result for no task scheduled. */
function createEmptyResult(iteration: number, error: string): IterationResult {
  return {
    iteration,
    selectedTask: null,
    selection: {
      selected: null,
      scored: [],
      strategy: 'utility',
      metadata: { candidatesConsidered: 0, durationMs: 0, explored: false, explorationParam: 0 },
    },
    actions: [],
    judgments: [],
    contracts: [],
    repairs: [],
    durationMs: 0,
    success: false,
    error,
  };
}