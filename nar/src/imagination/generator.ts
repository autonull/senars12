import { TermBuilder, termParser, type Term } from '../terms/index.js';
import { Truth } from '../terms/truth.js';
import type { Task } from '../types/core.js';
import { createTask, createBudget } from '../types/core.js';
import type { HiddenRule, Scenario, GeneratorConfig, ScenarioProfile } from './types.js';
import { HiddenModelOracle, createOracleFromScenario } from './oracle.js';

export class ScenarioGenerator {
  private readonly rng: () => number;
  private readonly config: Required<GeneratorConfig>;

  constructor(config: GeneratorConfig = {}) {
    this.config = {
      seed: config.seed ?? Date.now(),
      profile: config.profile ?? 'induction',
      hiddenModel: config.hiddenModel ?? [],
      eventCount: config.eventCount ?? 100,
      noiseLevel: config.noiseLevel ?? 0.1,
    };
    this.rng = mulberry32(this.config.seed);
  }

  generate(): Scenario {
    const oracle = this.config.hiddenModel.length > 0
      ? new HiddenModelOracle(this.config.hiddenModel)
      : createOracleFromScenario(this.config.profile, this.config.seed);

    const events = this.generateEvents(oracle);
    const oracleExpectations = oracle.computeExpectations(this.config.profile);

    return {
      seed: this.config.seed,
      profile: this.config.profile,
      hiddenModel: oracle.getHiddenRules(),
      events,
      oracle: oracleExpectations,
    };
  }

  private generateEvents(oracle: HiddenModelOracle): Task[] {
    const events: Task[] = [];
    const hiddenRules = oracle.getHiddenRules();

    for (let i = 0; i < this.config.eventCount; i++) {
      const eventType = this.selectEventType();
      let event: Task | null = null;

      switch (eventType) {
        case 'belief':
          event = this.generateBeliefEvent(hiddenRules);
          break;
        case 'question':
          event = this.generateQuestionEvent(hiddenRules);
          break;
        case 'goal':
          event = this.generateGoalEvent(hiddenRules);
          break;
      }

      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  private selectEventType(): 'belief' | 'question' | 'goal' {
    const r = this.rng();
    if (r < 0.6) return 'belief';
    if (r < 0.85) return 'question';
    return 'goal';
  }

  private generateBeliefEvent(hiddenRules: HiddenRule[]): Task | null {
    if (hiddenRules.length === 0) return null;

    const ruleIndex = Math.floor(this.rng() * hiddenRules.length);
    const rule = hiddenRules[ruleIndex];
    if (!rule) return null;
    const noise = this.rng() < this.config.noiseLevel;

    let termStr: string;
    let truth: Truth;

    if (noise) {
      termStr = this.corruptTerm(rule.term);
      truth = Truth.create(
        Math.max(0, Math.min(1, rule.truth.f + (this.rng() - 0.5) * 0.6)),
        Math.max(0, Math.min(0.999, rule.truth.c + (this.rng() - 0.5) * 0.6))
      );
    } else {
      termStr = rule.term;
      truth = Truth.create(
        Math.max(0, Math.min(1, rule.truth.f)),
        Math.max(0, Math.min(0.999, rule.truth.c))
      );
    }

    const term = this.parseTerm(termStr);
    return term ? createTask(term, 'belief', truth, createBudget(0.5)) : null;
  }

  private generateQuestionEvent(hiddenRules: HiddenRule[]): Task | null {
    if (hiddenRules.length === 0) return null;

    const ruleIndex = Math.floor(this.rng() * hiddenRules.length);
    const rule = hiddenRules[ruleIndex];
    if (!rule) return null;
    const termStr = rule.term.replace(/%.+$/, '').trim();
    const questionTermStr = termStr.replace(/^(\(.+\))$/, '($1)?');

    const term = this.parseTerm(questionTermStr);
    return term ? createTask(term, 'question', Truth.create(0.5, 0.5), createBudget(0.5)) : null;
  }

  private generateGoalEvent(hiddenRules: HiddenRule[]): Task | null {
    if (hiddenRules.length === 0) return null;

    const ruleIndex = Math.floor(this.rng() * hiddenRules.length);
    const rule = hiddenRules[ruleIndex];
    if (!rule) return null;
    const termStr = rule.term.replace(/%.+$/, '').trim();
    const priority = 0.5 + this.rng() * 0.4;

    const term = this.parseTerm(termStr);
    return term ? createTask(term, 'goal', Truth.create(priority, 0.8), createBudget(priority)) : null;
  }

  private parseTerm(termStr: string): Term | null {
    try {
      return termParser.parse(termStr);
    } catch {
      return null;
    }
  }

  private corruptTerm(term: string): string {
    const corruptions = [
      (t: string) => t.replace(/(\w+)/, (_, m) => m + '_noise'),
      (t: string) => t.replace('-->', '==>'),
      (t: string) => t.replace('==>', '-->'),
      (t: string) => t.replace(/(\w+)/, ''),
    ];
    const corruption = corruptions[Math.floor(this.rng() * corruptions.length)];
    return corruption ? corruption(term) : term;
  }

  static createForProfile(profile: ScenarioProfile, seed: number): ScenarioGenerator {
    return new ScenarioGenerator({ profile, seed });
  }
}

export function generateScenario(spec: GeneratorConfig): Scenario {
  return new ScenarioGenerator(spec).generate();
}

export function generateMultipleScenarios(
  count: number,
  baseConfig: GeneratorConfig
): Scenario[] {
  return Array.from({ length: count }, (_, i) =>
    new ScenarioGenerator({ ...baseConfig, seed: (baseConfig.seed ?? Date.now()) + i }).generate()
  );
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createInductionScenario(seed: number, eventCount = 100): Scenario {
  return generateScenario({
    seed,
    profile: 'induction',
    eventCount,
    noiseLevel: 0.15,
  });
}

export function createTransitiveScenario(seed: number, eventCount = 80): Scenario {
  return generateScenario({
    seed,
    profile: 'transitive',
    eventCount,
    noiseLevel: 0.05,
  });
}

export function createContradictionStormScenario(seed: number, eventCount = 120): Scenario {
  return generateScenario({
    seed,
    profile: 'contradiction_storm',
    eventCount,
    noiseLevel: 0.1,
  });
}

export function createOverloadScenario(seed: number, eventCount = 150, multiplier = 1): Scenario {
  return generateScenario({
    seed,
    profile: 'overload',
    eventCount: Math.floor(eventCount * multiplier),
    noiseLevel: 0.1,
  });
}

export function createDriftScenario(seed: number, eventCount = 200): Scenario {
  return generateScenario({
    seed,
    profile: 'drift',
    eventCount,
    noiseLevel: 0.2,
  });
}