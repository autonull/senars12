/**
 * Reasoner for performing inference steps
 */

import type {CoreConfig, Task} from '../types';
import {createBudget, createTask} from '../types';
import type {Memory} from '../memory';
import type {RuleProcessor, RuleResult, RuleInput} from '../rules';
import type {Strategy} from './strategy.js';
import {Stamp} from '../terms';
import {Truth} from '../terms';

export interface ReasonerConfig extends Pick<CoreConfig, 'cpuThrottleMs' | 'maxDerivationDepth' | 'maxDerivationsPerStep'> {
}

export class Reasoner {
  private readonly memory: Memory;
  private readonly processor: RuleProcessor;
  private readonly strategy: Strategy;
  private readonly config: ReasonerConfig;

  constructor(
    memory: Memory,
    processor: RuleProcessor,
    strategy: Strategy,
    config: ReasonerConfig
  ) {
    this.memory = memory;
    this.processor = processor;
    this.strategy = strategy;
    this.config = config;
  }

  async step(timeoutMs = 5000, maxResults = 100): Promise<Task[]> {
    const results: Task[] = [];
    const startTime = Date.now();
    const endTime = startTime + timeoutMs;

    for (const concept of this.memory.sample(100)) {
      if (Date.now() > endTime || results.length >= maxResults) break;

      const belief = concept.beliefBag.peek();
      const task: Task = createTask(
        concept.term,
        'belief',
        belief?.truth ?? Truth.NEUTRAL,
        createBudget(concept.priority)
      );

      for (const secondary of this.strategy.selectSecondary(task, this.memory)) {
        const p1: RuleInput = {term: task.term, truth: task.truth};
        const p2: RuleInput = {term: secondary.term, truth: secondary.truth ?? Truth.NEUTRAL};
        for (const result of this.processor.processSync(p1, p2)) {
          results.push(this.createDerivedTask(result));
        }
      }
    }

    return results;
  }

  async* run(timeoutMs = 5000, maxResults = 100): AsyncGenerator<Task> {
    const startTime = Date.now();
    let resultCount = 0;

    for (const concept of this.memory.sample(100)) {
      if (resultCount >= maxResults) break;

      const belief = concept.beliefBag.peek();
      const task: Task = createTask(
        concept.term,
        'belief',
        belief?.truth ?? Truth.NEUTRAL,
        createBudget(concept.priority)
      );

      for (const secondary of this.strategy.selectSecondary(task, this.memory)) {
        if (resultCount >= maxResults) break;

        const p1: RuleInput = {term: task.term, truth: task.truth};
        const p2: RuleInput = {term: secondary.term, truth: secondary.truth ?? Truth.NEUTRAL};
        
        for (const result of this.processor.processSync(p1, p2)) {
          yield this.createDerivedTask(result);
          resultCount++;
        }

        if (this.config.cpuThrottleMs > 0) {
          await new Promise(r => setTimeout(r, this.config.cpuThrottleMs));
        }
      }
    }
  }

  private createDerivedTask(result: RuleResult): Task {
    const derivedStamp = Stamp.derive([result.stamp], 'DERIVED') ?? Stamp.createInput();

    return {
      term: result.term,
      type: 'belief',
      truth: result.truth,
      budget: createBudget(result.priority),
      stamp: derivedStamp,
      occurrenceTime: Date.now(),
      derived: true
    };
  }
}
