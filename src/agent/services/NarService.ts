import type {NAR} from '../../nar/nar.js';
import type {Task} from '../../nar/types.js';
import {termParser} from '../../nar/terms.js';

export interface ConceptFilter {
  type?: 'belief' | 'goal' | 'question';
  term?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface NarServiceConfig {
  defaultRunSteps?: number;
  maxPaginationLimit?: number;
}

export class NarService {
  private readonly defaultRunSteps: number;
  private readonly maxPaginationLimit: number;

  constructor(
    private readonly nar: NAR,
    config: NarServiceConfig = {}
  ) {
    this.defaultRunSteps = config.defaultRunSteps ?? 5;
    this.maxPaginationLimit = config.maxPaginationLimit ?? 100;
  }

  async addBelief(term: string, truth?: { f: number; c: number }): Promise<{ added: true; term: string }> {
    await this.nar.believe(term, truth ? { f: truth.f, c: truth.c, t: 0 } : undefined);
    return { added: true, term };
  }

  async addGoal(term: string, truth?: { f: number; c: number }): Promise<{ added: true; term: string }> {
    await this.nar.goal(term, truth ? { f: truth.f, c: truth.c, t: 0 } : undefined);
    return { added: true, term };
  }

  async addQuestion(term: string): Promise<{ added: true; term: string }> {
    await this.nar.question(term);
    return { added: true, term };
  }

  async getConcepts(filter?: ConceptFilter, pagination?: PaginationParams): Promise<{ results: Task[]; count: number }> {
    let all: Task[] = [];
    
    switch (filter?.type) {
      case 'belief':
        all = this.nar.getBeliefs();
        break;
      case 'goal':
        all = this.nar.getGoals();
        break;
      case 'question':
        all = this.nar.getQuestions();
        break;
      default:
        all = [...this.nar.getBeliefs(), ...this.nar.getGoals(), ...this.nar.getQuestions()];
    }

    if (filter?.term) {
      all = all.filter(task => task.term.toString().includes(filter.term!));
    }

    const limit = Math.min(pagination?.limit ?? 20, this.maxPaginationLimit);
    const offset = pagination?.offset ?? 0;
    const paginated = all.slice(offset, offset + limit);

    return { results: paginated, count: all.length };
  }

  async run(steps?: number): Promise<{ derived: number }> {
    const derived = await this.nar.run(steps ?? this.defaultRunSteps);
    return { derived };
  }

  async query(term: string, filter?: Record<string, unknown>): Promise<{ results: Task[]; count: number }> {
    const results = this.nar.queryTerm(termParser.parse(term), filter);
    return { results: Array.isArray(results) ? results : [results], count: Array.isArray(results) ? results.length : 1 };
  }

  async getStats(): Promise<{
    totalConcepts: number;
    totalTasks: number;
    derivations: number;
    uptime: number;
  }> {
    const stats = this.nar.getStatistics();
    const metrics = this.nar.getMetrics();
    return {
      totalConcepts: stats.totalConcepts,
      totalTasks: stats.totalTasks,
      derivations: metrics.system.totalDerivations || 0,
      uptime: process.uptime()
    };
  }

  getConfig(): Record<string, unknown> {
    return this.nar.getConfig() as Record<string, unknown>;
  }

  getAttentionSnapshot(): { concepts: Array<{ term: string; priority: number }>; total: number } {
    return this.nar.attentionReport();
  }

  getHistory(limit: number = 50): Task[] {
    return this.nar.getBeliefs().slice(0, limit);
  }
}
