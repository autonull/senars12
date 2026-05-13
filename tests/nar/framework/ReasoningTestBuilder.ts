/**
 * Declarative Test Framework for NARS12
 * Fluent DSL for specifying multi-cycle reasoning tests
 */

import {NAR} from '../../../src/nar/nar.js';
import type {NARConfig} from '../../../src/nar/nar.js';
import type {TaskType} from '../../types/index.js';
import type {Truth as TruthType} from '../../terms/truth.js';
import type {Term} from '../../terms/types.js';

export interface Premise {
  term: string | Term;
  type: TaskType;
  truth: TruthType;
  label?: string;
}

export interface ExpectedDerivation {
  term: string | Term;
  type?: TaskType;
  truthRange?: {
    minFrequency?: number;
    maxFrequency?: number;
    minConfidence?: number;
    maxConfidence?: number;
  };
  minPriority?: number;
  label?: string;
}

export interface TestSpec {
  name: string;
  premises: Premise[];
  cycles: number;
  expect: ExpectedDerivation[];
  expectNot?: ExpectedDerivation[];
  config?: Partial<NARConfig>;
}

export interface TestResult {
  success: boolean;
  name: string;
  passed: boolean;
  errors: string[];
  derivedConcepts: Array<{term: string; priority: number; truth?: TruthType}>;
}

function formatValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatErrors(errors: string[]): string {
  return errors.map(e => `  - ${e}`).join('\n');
}

export async function assertReasoning(spec: TestSpec): Promise<TestResult> {
  const nar = new NAR(spec.config ? spec.config as NARConfig : undefined);
  const errors: string[] = [];
  const derivedConcepts: Array<{term: string; priority: number; truth?: TruthType}> = [];

  try {
    for (const premise of spec.premises) {
      await nar.input(premise.term, premise.type, premise.truth);
    }

    await nar.run(spec.cycles);

    const concepts = nar.memory.listConcepts();
    concepts.forEach(concept => {
      derivedConcepts.push({
        term: concept.term.toString(),
        priority: concept.priority,
        truth: (concept as any).truth
      });
    });

    for (const expected of spec.expect) {
      const termStr = typeof expected.term === 'string' ? expected.term : expected.term.toString();
      const found = concepts.find(c => c.term.toString() === termStr);

      if (!found) {
        errors.push(`Expected derivation not found: "${termStr}"`);
        continue;
      }

      if (expected.minPriority && found.priority < expected.minPriority) {
        errors.push(
          `Priority too low for "${termStr}": expected >= ${expected.minPriority}, got ${found.priority}`
        );
      }

      if (expected.truthRange) {
        const truth = (found as any).truth;
        if (truth) {
          const {minFrequency, maxFrequency, minConfidence, maxConfidence} = truth;
          if (minFrequency && truth.f < minFrequency) {
            errors.push(
              `Frequency too low for "${termStr}": expected >= ${minFrequency}, got ${truth.f}`
            );
          }
          if (maxFrequency && truth.f > maxFrequency) {
            errors.push(
              `Frequency too high for "${termStr}": expected <= ${maxFrequency}, got ${truth.f}`
            );
          }
          if (minConfidence && truth.c < minConfidence) {
            errors.push(
              `Confidence too low for "${termStr}": expected >= ${minConfidence}, got ${truth.c}`
            );
          }
          if (maxConfidence && truth.c > maxConfidence) {
            errors.push(
              `Confidence too high for "${termStr}": expected <= ${maxConfidence}, got ${truth.c}`
            );
          }
        }
      }
    }

    if (spec.expectNot) {
      for (const notExpected of spec.expectNot) {
        const termStr = typeof notExpected.term === 'string' ? notExpected.term : notExpected.term.toString();
        const found = concepts.find(c => c.term.toString() === termStr);

        if (found) {
          errors.push(`Unexpected derivation found: "${termStr}"`);
        }
      }
    }
  } catch (error) {
    errors.push(`Test execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    success: errors.length === 0,
    name: spec.name,
    passed: errors.length === 0,
    errors,
    derivedConcepts
  };
}

export function describeReasoning(name: string, specs: TestSpec[]): void {
  describe(name, () => {
    specs.forEach(spec => {
      it(spec.name, async () => {
        const result = await assertReasoning(spec);
        if (!result.passed) {
          const errorMessages = [
            `Test "${spec.name}" failed:`,
            ...result.errors.map(e => `  - ${e}`)
          ];
          throw new Error(errorMessages.join('\n'));
        }
      });
    });
  });
}

export function createPremise(
  term: string,
  type: TaskType = 'belief',
  frequency = 0.9,
  confidence = 0.9,
  label?: string
): Premise {
  return {
    term,
    type,
    truth: {f: frequency, c: confidence},
    label
  };
}

export function expectDerivation(
  term: string,
  options?: {
    minFrequency?: number;
    maxFrequency?: number;
    minConfidence?: number;
    maxConfidence?: number;
    minPriority?: number;
    label?: string;
  }
): ExpectedDerivation {
  return {
    term,
    truthRange: options
      ? {
          minFrequency: options.minFrequency,
          maxFrequency: options.maxFrequency,
          minConfidence: options.minConfidence,
          maxConfidence: options.maxConfidence
        }
      : undefined,
    minPriority: options?.minPriority,
    label: options?.label
  };
}

export class ReasoningTestBuilder {
  private spec: TestSpec = {
    name: '',
    premises: [],
    cycles: 1,
    expect: [],
    expectNot: []
  };

  name(testName: string): this {
    (this.spec as TestSpec).name = testName;
    return this;
  }

  premise(term: string, type: TaskType = 'belief', frequency = 0.9, confidence = 0.9): this {
    this.spec.premises.push({term, type, truth: {f: frequency, c: confidence}});
    return this;
  }

  premises(premises: Premise[]): this {
    this.spec.premises = [...this.spec.premises, ...premises];
    return this;
  }

  cycleCount(cycles: number): this {
    this.spec.cycles = cycles;
    return this;
  }

  expect(term: string, options?: ExpectedDerivation['truthRange'], minPriority?: number): this {
    this.spec.expect.push({term, truthRange: options, minPriority});
    return this;
  }

  expectNot(term: string): this {
    this.spec.expectNot?.push({term});
    return this;
  }

  configure(config: Partial<NARConfig>): this {
    this.spec.config = config;
    return this;
  }

  build(): TestSpec {
    if (!this.spec.name) {
      throw new Error('Test must have a name');
    }
    return this.spec;
  }

  async run(): Promise<TestResult> {
    const spec = this.build();
    return assertReasoning(spec);
  }
}

export function testReasoning(): ReasoningTestBuilder {
  return new ReasoningTestBuilder();
}
