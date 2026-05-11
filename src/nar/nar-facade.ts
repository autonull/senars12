import type {Term} from './terms';
import type {Task, TruthFilter} from './types';
import type {Memory} from './memory';
import type {QueryAPI, QueryResult, Answer} from './query';
import type {ReasoningTrace} from './query';
import type {Tool, ToolManager, ToolResult} from './tools';
import type {MetricsCollector} from './metrics';

export class NARFacade {
  constructor(
    private readonly memory: Memory,
    private readonly query: QueryAPI,
    private readonly traceAPI: ReasoningTrace,
    private readonly tools: ToolManager,
    private readonly metrics: MetricsCollector
  ) {}

  getBeliefs(filter?: Record<string, unknown>): Task[] {
    return this.query.getBeliefs(filter);
  }

  getGoals(filter?: Record<string, unknown>): Task[] {
    return this.query.getGoals(filter as any);
  }

  getQuestions(filter?: Record<string, unknown>): Task[] {
    return this.query.getQuestions(filter as any);
  }

  queryTerm(term: Term, filter?: Record<string, unknown>): QueryResult {
    return this.query.query(term, filter);
  }

  ask(question: string | Term): Promise<Answer> {
    return this.query.ask(question);
  }

  getDerivationHistory(task: Task): unknown {
    return this.traceAPI.getDerivationHistory(task);
  }

  traceTerm(term: Term): unknown {
    return this.traceAPI.trace(term);
  }

  explain(conclusion: Task): unknown {
    return this.traceAPI.explain(conclusion);
  }

  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    return this.tools.execute(name, args);
  }

  listTools(): Tool[] {
    return this.tools.list();
  }

  getMetrics() {
    return this.metrics.getSummary();
  }

  recordRuleExecution(ruleId: string, success: boolean, duration: number): void {
    this.metrics.recordRuleExecution(ruleId, success, duration);
  }

  incrementDerivations(count?: number): void {
    this.metrics.incrementDerivations(count);
  }

  incrementSteps(count?: number): void {
    this.metrics.incrementSteps(count);
  }
}
