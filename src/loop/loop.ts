/**
 * Loop — the one cognitive loop.
 *
 * Orchestrates selection, action, judgment, contracts, repair, and recording
 * into a single coherent iteration.
 */

import { createActionSelector, type ActionSelector, type SelectionContext, type SelectionResult, type SelectionCandidate } from './select.js';
import { createLoopRecorder, type LoopRecorder, type LoopRecord, type IterationRecord as LoopIterationRecord, type ContractRecord } from './record.js';
import { createSelfModelManager, type SelfModelManager } from './self-model.js';
import { ContractRegistry, type ContractCheckResult, type ContractContext, checkContracts } from './contract.js';
import type { RepairLoop, RepairContext, RepairResult as LoopRepairResult } from './repair.js';
import type { LoopAppraisal } from './appraise.js';
import type { Economy, EconomyTask, EconomyScheduler, SchedulerResult, EconomyEvent, EconomyEventType } from '../economy/index.js';
import type { FacultyRegistry, FacultySpec, FacultyInput, FacultyOutput } from '../faculties/specs.js';
import type { OracleRegistry, Oracle, OracleInput, OracleOutput } from '../oracles/oracle.js';
import type { Term } from '../kernel/terms/term.js';
import type { Task } from '../kernel/types.js';
import type { Truth } from '../kernel/truth.js';

/** Loop configuration. */
export interface LoopConfig {
  /** Maximum iterations. */
  maxIterations?: number;
  /** Iteration timeout (ms). */
  iterationTimeoutMs?: number;
  /** Enable recording. */
  recordEnabled?: boolean;
  /** Enable contracts. */
  contractsEnabled?: boolean;
  /** Enable repair. */
  repairEnabled?: boolean;
  /** Enable self-model. */
  selfModelEnabled?: boolean;
  /** Enable appraisal. */
  appraisalEnabled?: boolean;
  /** Correlation ID for tracing. */
  correlationId?: string;
}

/** Default loop config. */
export const defaultLoopConfig: LoopConfig = {
  maxIterations: 10000,
  iterationTimeoutMs: 5000,
  recordEnabled: true,
  contractsEnabled: true,
  repairEnabled: true,
  selfModelEnabled: true,
  appraisalEnabled: true,
};

/** Loop iteration result. */
export interface IterationResult {
  /** Iteration number. */
  iteration: number;
  /** Selected task. */
  selectedTask: EconomyTask | null;
  /** Selection result. */
  selection: SelectionResult;
  /** Action results. */
  actions: ActionResult[];
  /** Judgment results. */
  judgments: JudgmentResult[];
  /** Contract results. */
  contracts: ContractCheckResult[];
  /** Repair results. */
  repairs: LoopRepairResult[];
  /** Appraisal. */
  appraisal?: LoopAppraisal;
  /** Duration (ms). */
  durationMs: number;
  /** Success. */
  success: boolean;
  /** Error if failed. */
  error?: string;
}

/** Action execution result. */
export interface ActionResult {
  /** Action ID. */
  actionId: string;
  /** Task executed. */
  task: EconomyTask;
  /** Success. */
  success: boolean;
  /** Output. */
  output?: unknown;
  /** Effects applied. */
  effects: EffectResult[];
  /** Duration (ms). */
  durationMs: number;
  /** Error if failed. */
  error?: string;
}

/** Effect application result. */
export interface EffectResult {
  /** Effect type. */
  type: string;
  /** Target term. */
  term: Term;
  /** Success. */
  success: boolean;
  /** New truth if updated. */
  newTruth?: Truth;
}

/** Judgment result. */
export interface JudgmentResult {
  /** Judgment ID. */
  judgmentId: string;
  /** Task judged. */
  task: EconomyTask;
  /** Score. */
  score: number;
  /** Confidence. */
  confidence: number;
  /** Details. */
  details: Record<string, unknown>;
}

/** Loop context passed to components. */
export interface LoopContext {
  /** Current iteration. */
  iteration: number;
  /** Economy instance. */
  economy: Economy;
  /** Economy scheduler. */
  scheduler: EconomyScheduler;
  /** Faculty registry. */
  faculties: FacultyRegistry;
  /** Oracle registry. */
  oracles: OracleRegistry;
  /** Contract registry. */
  contracts?: ContractRegistry;
  /** Repair loop. */
  repair?: RepairLoop;
  /** Recorder. */
  recorder?: LoopRecorder;
  /** Self-model. */
  selfModel?: SelfModelManager;
  /** Action selector. */
  selector: ActionSelector;
  /** Configuration. */
  config: LoopConfig;
  /** Correlation ID. */
  correlationId: string;
}

/** Faculty invoker. */
interface FacultyInvoker {
  spec: FacultySpec;
  invoke: (input: FacultyInput) => Promise<FacultyOutput>;
}

/** Loop event. */
export const LOOP_EVENTS = [
  'iteration_start',
  'iteration_complete',
  'iteration_failed',
  'selection_made',
  'action_executed',
  'judgment_complete',
  'contract_checked',
  'repair_complete',
  'appraisal_complete',
  'max_iterations_reached',
  'timeout',
] as const;

export type LoopEventType = (typeof LOOP_EVENTS)[number];

export interface LoopEvent {
  type: LoopEventType;
  iteration: number;
  timestamp: number;
  correlationId: string;
  data: Record<string, unknown>;
}

/** Main loop class. */
export class CognitiveLoop {
  private config: LoopConfig;
  private context: LoopContext;
  private facultyInvokers: Map<string, FacultyInvoker> = new Map();
  private running = false;
  private stopped = false;
  private eventListeners: Map<LoopEventType, Set<(event: LoopEvent) => void>> = new Map();
  private economyEventUnsub: (() => void)[] = [];

  constructor(
    economy: Economy,
    scheduler: EconomyScheduler,
    faculties: FacultyRegistry,
    oracles: OracleRegistry,
    config: Partial<LoopConfig> = {}
  ) {
    this.config = { ...defaultLoopConfig, ...config };
    this.context = this.createContext(economy, scheduler, faculties, oracles);
    this.initializeFacultyInvokers(faculties);
    this.initializeEventListeners();
    this.subscribeToEconomyEvents();
  }

  private createContext(
    economy: Economy,
    scheduler: EconomyScheduler,
    faculties: FacultyRegistry,
    oracles: OracleRegistry
  ): LoopContext {
    const correlationId = this.config.correlationId ?? crypto.randomUUID();
    const recorder = this.config.recordEnabled ? createLoopRecorder(undefined, correlationId) : undefined;
    const selfModel = this.config.selfModelEnabled ? createSelfModelManager() : undefined;
    const selector = createActionSelector();

    return {
      iteration: 0,
      economy,
      scheduler,
      faculties,
      oracles,
      contracts: undefined, // ContractRegistry - set externally if needed
      repair: undefined, // RepairLoop - set externally if needed
      recorder,
      selfModel,
      selector,
      config: this.config,
      correlationId,
    };
  }

  private initializeFacultyInvokers(faculties: FacultyRegistry): void {
    // Access internal specs map via reflection (since specs is private)
    // In production, FacultyRegistry should expose an iterator
    const specsMap = (faculties as unknown as { specs: Map<string, FacultySpec> }).specs;
    if (specsMap) {
      for (const [name, spec] of specsMap) {
        this.facultyInvokers.set(name, {
          spec,
          invoke: async (input: FacultyInput) => {
            // Try fallback first
            try {
              const fallbackResult = await spec.fallback(input);
              if (fallbackResult) return fallbackResult;
            } catch {
              // Fallback failed, try oracle
            }

            // Try oracle
            // This would need access to oracle registry
            // For now, return a basic output
            return {
              faculty: spec.name,
              result: null,
              confidence: 0.5,
              durationMs: 0,
            };
          },
        });
      }
    }
  }

  private initializeEventListeners(): void {
    for (const eventType of LOOP_EVENTS) {
      this.eventListeners.set(eventType, new Set());
    }
  }

  private subscribeToEconomyEvents(): void {
    const economyEvents: EconomyEventType[] = [
      'task_scheduled',
      'task_completed',
      'task_failed',
      'fairness_violation',
      'overlay_activated',
      'overlay_deactivated',
    ];

    for (const eventType of economyEvents) {
      this.economyEventUnsub.push(
        this.context.economy.on(eventType, (event) => {
          this.emit('iteration_complete', {
            economyEvent: eventType,
            ...event.data,
          });
        })
      );
    }
  }

  /** Run the loop for a number of iterations. */
  async run(iterations?: number): Promise<IterationResult[]> {
    const maxIter = iterations ?? this.config.maxIterations ?? 10000;
    const results: IterationResult[] = [];

    this.running = true;
    this.stopped = false;

    this.emit('iteration_start', { maxIterations: maxIter });

    for (let i = 0; i < maxIter && !this.stopped; i++) {
      this.context.iteration = i + 1;

      try {
        const result = await this.runIteration();
        results.push(result);

        if (!result.success) {
          this.emit('iteration_failed', { iteration: this.context.iteration, error: result.error });
        }

        // Check for early termination
        if (this.shouldTerminate(result)) {
          break;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const result: IterationResult = {
          iteration: this.context.iteration,
          selectedTask: null,
          selection: { selected: null, scored: [], strategy: 'utility', metadata: { candidatesConsidered: 0, durationMs: 0, explored: false, explorationParam: 0 } },
          actions: [],
          judgments: [],
          contracts: [],
          repairs: [],
          durationMs: 0,
          success: false,
          error: errorMsg,
        };
        results.push(result);
        this.emit('iteration_failed', { iteration: this.context.iteration, error: errorMsg });

        if (!this.isRecoverable(error)) {
          break;
        }
      }
    }

    this.running = false;

    if (this.context.iteration >= maxIter) {
      this.emit('max_iterations_reached', { iterations: this.context.iteration });
    }

    return results;
  }

  /** Run a single iteration. */
  async runIteration(): Promise<IterationResult> {
    const startTs = Date.now();
    const iteration = this.context.iteration;

    this.emit('iteration_start', { iteration });

    // 1. Schedule task from economy
    const scheduleResult = this.context.scheduler.schedule();
    this.emit('selection_made', { iteration, taskId: scheduleResult.task?.id });

    if (!scheduleResult.task) {
      return this.createEmptyResult(iteration, startTs, 'No task scheduled');
    }

    // 2. Build selection context
    const selectionContext = this.buildSelectionContext(scheduleResult);
    const selection = await this.context.selector.select(selectionContext);

    // 3. Execute actions for selected task
    const actions = await this.executeActions(selection.selected, scheduleResult.task);

    // 4. Run judgments
    const judgments = await this.runJudgments(scheduleResult.task, actions);

    // 5. Check contracts
    const contracts = await this.checkContracts(scheduleResult.task, actions);

    // 6. Run repair if needed
    const repairs = await this.runRepairs(scheduleResult.task, actions, contracts);

    // 7. Appraise iteration
    const appraisal = await this.appraiseIteration(scheduleResult.task, actions, judgments, contracts, repairs);

    // 8. Update self-model
    if (this.context.selfModel && appraisal) {
      this.context.selfModel.updateFromAppraisal(appraisal);
    }

    // 9. Record iteration
    if (this.context.recorder) {
      await this.recordIteration(scheduleResult.task, selection, actions, judgments, contracts, repairs, appraisal);
    }

    // 10. Tick self-model
    if (this.context.selfModel) {
      this.context.selfModel.tick();
    }

    const durationMs = Date.now() - startTs;

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

    this.emit('iteration_complete', { iteration, durationMs, success: result.success });
    return result;
  }

  /** Build selection context from economy state. */
  private buildSelectionContext(scheduleResult: SchedulerResult): SelectionContext {
    const tasks = this.context.economy.getAllTasks();
    const beliefs = tasks.filter(t => t.kind === 'belief');
    const goals = tasks.filter(t => t.kind === 'goal');

    const candidates: SelectionCandidate[] = scheduleResult.candidates.map(c => ({
      id: c.task.id,
      action: c.task as unknown as Task,
      utility: c.utility,
      voi: 0, // Could compute from voi.ts
      confidence: c.task.truth.c,
      sourceFaculty: 'economy',
      evidence: [],
      cost: 1,
      risk: 0,
      priority: c.task.weight,
    }));

    return {
      candidates,
      beliefs: beliefs as unknown as Task[],
      goals: goals as unknown as Task[],
      budget: scheduleResult.metadata.budgetRemaining,
      urgency: 0.5,
      riskTolerance: 0.5,
      iteration: this.context.iteration,
      history: [],
    };
  }

  /** Execute actions for a task. */
  private async executeActions(
    selected: SelectionCandidate | null,
    scheduledTask: EconomyTask
  ): Promise<ActionResult[]> {
    if (!selected) return [];

    const task = this.context.economy.getTask(selected.id) ?? scheduledTask;
    const results: ActionResult[] = [];

    // Try faculty invokers
    for (const [name, invoker] of this.facultyInvokers) {
      if (this.taskMatchesFaculty(task, invoker.spec)) {
        const actionStart = Date.now();
        try {
          const input: FacultyInput = {
            faculty: invoker.spec.name,
            primary: task.term,
            context: { truth: task.truth },
            budget: 10,
            priority: task.weight,
          };
          const output = await invoker.invoke(input);
          const durationMs = Date.now() - actionStart;

          results.push({
            actionId: `faculty-${name}-${task.id}`,
            task,
            success: true,
            output,
            effects: this.convertFacultyOutput(output),
            durationMs,
          });

          this.emit('action_executed', { iteration: this.context.iteration, faculty: name, taskId: task.id });
        } catch (error) {
          results.push({
            actionId: `faculty-${name}-${task.id}`,
            task,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            effects: [],
            durationMs: Date.now() - actionStart,
          });
        }
      }
    }

    // If no faculty handled it, try oracle
    if (results.length === 0) {
      for (const [op, oracle] of (this.context.oracles as unknown as { oracles: Map<string, Oracle> }).oracles) {
        if (this.taskMatchesOracle(task, oracle)) {
          const actionStart = Date.now();
          try {
            const input: OracleInput = {
              operation: oracle.operation,
              args: [{ term: task.term.toString() }],
              context: { seed: Date.now() },
            };
            const output = await oracle.call(input);
            const durationMs = Date.now() - actionStart;

            results.push({
              actionId: `oracle-${op}-${task.id}`,
              task,
              success: true,
              output,
              effects: this.convertOracleOutput(output),
              durationMs,
            });

            this.emit('action_executed', { iteration: this.context.iteration, oracle: op, taskId: task.id });
            break; // Only one oracle per task
          } catch (error) {
            results.push({
              actionId: `oracle-${op}-${task.id}`,
              task,
              success: false,
              error: error instanceof Error ? error.message : String(error),
              effects: [],
              durationMs: Date.now() - actionStart,
            });
          }
        }
      }
    }

    return results;
  }

  /** Check if task matches faculty spec. */
  private taskMatchesFaculty(task: EconomyTask, spec: FacultySpec): boolean {
    // Match by category or name in task tags/term
    const taskStr = task.term.toString().toLowerCase();
    return task.tags.includes(spec.category) ||
           taskStr.includes(spec.name) ||
           spec.name === 'grounding' && task.kind === 'belief' ||
           spec.name === 'inference' && task.kind === 'goal' ||
           spec.name === 'planning' && task.kind === 'plan';
  }

  /** Check if task matches oracle. */
  private taskMatchesOracle(task: EconomyTask, oracle: Oracle): boolean {
    // Simple matching by operation name in term
    const taskStr = task.term.toString().toLowerCase();
    return taskStr.includes(oracle.operation.toLowerCase());
  }

  /** Convert faculty output to effects. */
  private convertFacultyOutput<T>(output: FacultyOutput<T>): EffectResult[] {
    // FacultyOutput.result contains the actual result; evidence is metadata
    // For now return empty - effects would be derived from result in a real implementation
    return [];
  }

  /** Convert oracle output to effects. */
  private convertOracleOutput<T>(output: OracleOutput<T>): EffectResult[] {
    // Oracle output doesn't directly give effects; would need to parse
    return [];
  }

  /** Run judgments on task and actions. */
  private async runJudgments(
    task: EconomyTask,
    actions: ActionResult[]
  ): Promise<JudgmentResult[]> {
    // Simplified: would integrate with judgment cascade
    return [{
      judgmentId: `judgment-${task.id}`,
      task,
      score: actions.every(a => a.success) ? 0.8 : 0.3,
      confidence: 0.7,
      details: { actions: actions.length, successes: actions.filter(a => a.success).length },
    }];
  }

  /** Check contracts. */
  private async checkContracts(
    task: EconomyTask,
    actions: ActionResult[]
  ): Promise<ContractCheckResult[]> {
    if (!this.context.contracts || !this.config.contractsEnabled) return [];

    // Use actual contract checker
    const contractContext: ContractContext = {
      iteration: this.context.iteration,
      currentTask: task as unknown as Task,
      focusBag: this.context.economy.getAllTasks() as unknown as Task[],
      beliefs: this.context.economy.getTasksByKind('belief') as unknown as Task[],
      goals: this.context.economy.getTasksByKind('goal') as unknown as Task[],
      selectedAction: task as unknown as Task,
      oracleCalls: [],
      resources: { tokensUsed: 0, tokensRemaining: 1000, wallTimeMs: 0, cpuTimeMs: 0 },
    };

    const results = await checkContracts(contractContext);
    return results;
  }

  /** Run repairs. */
  private async runRepairs(
    task: EconomyTask,
    actions: ActionResult[],
    contracts: ContractCheckResult[]
  ): Promise<LoopRepairResult[]> {
    if (!this.context.repair || !this.config.repairEnabled) return [];

    const failedContracts = contracts.filter(c => !c.passed);
    if (failedContracts.length === 0) return [];

    // Use actual repair loop
    const repairContext: RepairContext = {
      iteration: this.context.iteration,
      recentTasks: [],
      beliefs: this.context.economy.getTasksByKind('belief') as unknown as Task[],
      goals: this.context.economy.getTasksByKind('goal') as unknown as Task[],
      resources: { cpu: 0, memory: 0, tokensUsed: 0, tokensRemaining: 1000, wallTimeMs: 0 },
      oracleHealth: [],
      gateStates: [],
    };

    const results = await this.context.repair.tick(repairContext);
    return results;
  }

  /** Appraise iteration. */
  private async appraiseIteration(
    task: EconomyTask,
    actions: ActionResult[],
    judgments: JudgmentResult[],
    contracts: ContractCheckResult[],
    repairs: LoopRepairResult[]
  ): Promise<LoopAppraisal | undefined> {
    if (!this.config.appraisalEnabled) return undefined;

    // Simplified: would use actual appraise module
    const success = actions.every(a => a.success);
      const overallScore = success ? 0.8 : 0.4;
      return {
        iteration: this.context.iteration,
        timestamp: Date.now(),
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

  /** Record iteration. */
  private async recordIteration(
    task: EconomyTask,
    selection: SelectionResult,
    actions: ActionResult[],
    judgments: JudgmentResult[],
    contracts: ContractCheckResult[],
    repairs: LoopRepairResult[],
    appraisal?: LoopAppraisal
  ): Promise<void> {
    if (!this.context.recorder) return;

    const now = Date.now();
    const iteration = this.context.iteration;
    const correlationId = this.context.correlationId;

    const contractRecords: ContractRecord[] = contracts.map((c, i) => ({
      type: 'contract',
      id: crypto.randomUUID(),
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

    const payload: LoopIterationRecord['payload'] = {
      task: task as unknown as Task,
      action: task as unknown as Task,
      outcome: actions.every(a => a.success) ? 'success' : actions.some(a => a.success) ? 'partial' : 'failure',
      durationMs: actions.reduce((sum, a) => sum + a.durationMs, 0),
      resources: {
        tokensUsed: 0,
        oracleCalls: actions.filter(a => a.actionId.startsWith('oracle')).length,
        facultyCalls: actions.filter(a => a.actionId.startsWith('faculty')).length,
      },
      contracts: contractRecords,
    };

    await this.context.recorder.recordIteration(payload);
  }

  /** Check if loop should terminate early. */
  private shouldTerminate(result: IterationResult): boolean {
    // Terminate on repeated failures
    // Could implement more sophisticated termination criteria
    return false;
  }

  /** Check if error is recoverable. */
  private isRecoverable(error: unknown): boolean {
    // Most errors are recoverable in the loop
    return true;
  }

  /** Create empty result. */
  private createEmptyResult(iteration: number, startTs: number, error: string): IterationResult {
    return {
      iteration,
      selectedTask: null,
      selection: { selected: null, scored: [], strategy: 'utility', metadata: { candidatesConsidered: 0, durationMs: 0, explored: false, explorationParam: 0 } },
      actions: [],
      judgments: [],
      contracts: [],
      repairs: [],
      durationMs: Date.now() - startTs,
      success: false,
      error,
    };
  }

  /** Stop the loop. */
  stop(): void {
    this.stopped = true;
  }

  /** Check if running. */
  isRunning(): boolean {
    return this.running;
  }

  /** Get current iteration. */
  getIteration(): number {
    return this.context.iteration;
  }

  /** Get loop context. */
  getContext(): LoopContext {
    return this.context;
  }

  /** Event emission. */
  private emit(type: LoopEventType, data: Record<string, unknown>): void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return;

    const event: LoopEvent = {
      type,
      iteration: this.context.iteration,
      timestamp: Date.now(),
      correlationId: this.context.correlationId,
      data,
    };

    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Ignore
      }
    }
  }

  /** Subscribe to loop events. */
  on(type: LoopEventType, listener: (event: LoopEvent) => void): () => void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Cleanup. */
  async close(): Promise<void> {
    this.stop();
    for (const unsub of this.economyEventUnsub) {
      unsub();
    }
    if (this.context.recorder) {
      await this.context.recorder.close();
    }
  }
}

/** Create a cognitive loop. */
export function createCognitiveLoop(
  economy: Economy,
  scheduler: EconomyScheduler,
  faculties: FacultyRegistry,
  oracles: OracleRegistry,
  config?: Partial<LoopConfig>
): CognitiveLoop {
  return new CognitiveLoop(economy, scheduler, faculties, oracles, config);
}