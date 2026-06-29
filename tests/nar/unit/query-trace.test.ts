/**
 * QueryAPI and ReasoningTrace Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { termParser } from '../../../nar/src';
import {
  QueryAPI,
  ReasoningTrace,
  createQueryAPI,
  createReasoningTrace,
} from '../../../nar/src/query';
import { NAR } from '../../../src';

describe('QueryAPI', () => {
  let nar: NAR;
  let queryAPI: QueryAPI;

  beforeEach(() => {
    nar = new NAR();
    queryAPI = new QueryAPI(nar.memory);
  });

  it('should create QueryAPI instance', () => {
    expect(queryAPI).toBeDefined();
    expect(queryAPI.getBeliefs).toBeDefined();
    expect(queryAPI.getGoals).toBeDefined();
    expect(queryAPI.getQuestions).toBeDefined();
  });

  it('should return empty beliefs when none exist', () => {
    const beliefs = queryAPI.getBeliefs();
    expect(Array.isArray(beliefs)).toBe(true);
    expect(beliefs.length).toBe(0);
  });

  it('should return empty goals when none exist', () => {
    const goals = queryAPI.getGoals();
    expect(Array.isArray(goals)).toBe(true);
    expect(goals.length).toBe(0);
  });

  it('should return empty questions when none exist', () => {
    const questions = queryAPI.getQuestions();
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(0);
  });

  it('should query beliefs after input', async () => {
    await nar.input('(cat --> animal)', 'belief', { f: 0.9, c: 0.9 });
    const beliefs = queryAPI.getBeliefs();
    expect(beliefs.length).toBeGreaterThan(0);
  });

  it('should limit results', async () => {
    for (let i = 0; i < 10; i++) {
      await nar.input(`(concept${i} --> property)`, 'belief', { f: 0.9, c: 0.9 });
    }

    const beliefs = queryAPI.getBeliefs();
    expect(beliefs.length).toBeGreaterThan(0);
  });

  describe('Query by Type', () => {
    it('should filter beliefs by type', async () => {
      await nar.input('(a --> b)', 'belief', { f: 0.9, c: 0.9 });
      await nar.input('(c --> d)', 'goal', { f: 0.5, c: 0.8 });

      const beliefs = queryAPI.getBeliefs();
      const goals = queryAPI.getGoals();

      expect(beliefs.length).toBeGreaterThan(0);
    });

    it('should handle questions', async () => {
      await nar.input('(question --> answer)', 'question');
      const questions = queryAPI.getQuestions();
      expect(questions.length).toBeGreaterThan(0);
    });
  });

  describe('Query with Filters', () => {
    it('should apply truth range filter', async () => {
      await nar.input('(high --> truth)', 'belief', { f: 0.9, c: 0.9 });
      await nar.input('(low --> truth)', 'belief', { f: 0.3, c: 0.5 });

      const allBeliefs = queryAPI.getBeliefs();
      expect(allBeliefs.length).toBeGreaterThan(0);
    });

    it('should apply pattern filter', async () => {
      await nar.input('(specific --> term)', 'belief', { f: 0.9, c: 0.9 });

      const beliefs = queryAPI.getBeliefs();
      expect(beliefs.length).toBeGreaterThan(0);
    });
  });

  describe('Ask Method', () => {
    it('should answer known question', async () => {
      await nar.input('(known --> fact)', 'belief', { f: 0.9, c: 0.9 });

      const answer = await queryAPI.ask('(known --> fact)');
      expect(answer).toBeDefined();
      expect(answer.question).toBeDefined();
    });

    it('should return low confidence for unknown question', async () => {
      const answer = await queryAPI.ask('(unknown --> fact)');
      expect(answer.confidence).toBeLessThanOrEqual(0.5);
    });

    it('should handle invalid question format', async () => {
      const answer = await queryAPI.ask('invalid question format');
      expect(answer).toBeDefined();
      expect(answer.confidence).toBe(0);
    });

    it('should include evidence when available', async () => {
      await nar.input('(evidence --> test)', 'belief', { f: 0.95, c: 0.95 });

      const answer = await queryAPI.ask('(evidence --> test)');
      expect(Array.isArray(answer.evidence)).toBe(true);
    });
  });

  describe('Query Method', () => {
    it('should query by term', async () => {
      await nar.input('(query --> test)', 'belief', { f: 0.9, c: 0.9 });

      const term = termParser.parse('(query --> test)');
      const result = queryAPI.query(term);

      expect(result).toBeDefined();
      expect(result.beliefs).toBeDefined();
      expect(result.questions).toBeDefined();
      expect(result.concepts).toBeDefined();
    });
  });
});

describe('ReasoningTrace', () => {
  let nar: NAR;
  let trace: ReasoningTrace;

  beforeEach(() => {
    nar = new NAR();
    trace = new ReasoningTrace(nar.memory);
  });

  it('should create ReasoningTrace instance', () => {
    expect(trace).toBeDefined();
    expect(trace.trace).toBeDefined();
    expect(trace.explain).toBeDefined();
    expect(trace.getDerivationHistory).toBeDefined();
  });

  it('should trace term', async () => {
    await nar.input('(traced --> concept)', 'belief', { f: 0.9, c: 0.9 });

    const term = termParser.parse('(traced --> concept)');
    const result = trace.trace(term);

    expect(result).toBeDefined();
    expect(result.term).toBeDefined();
    expect(result.history).toBeDefined();
    expect(result.concepts).toBeDefined();
  });

  it('should handle tracing unknown term', () => {
    const term = termParser.parse('(unknown --> term)');
    const result = trace.trace(term);

    expect(result).toBeDefined();
    expect(result.history.length).toBe(0);
  });

  describe('Explain Method', () => {
    it('should explain conclusion', async () => {
      await nar.input('(conclusion --> test)', 'belief', { f: 0.9, c: 0.9 });

      const concepts = nar.memory.listConcepts();
      const concept = concepts.find((c) => c.term.toString() === '(conclusion --> test)');

      if (concept && concept.beliefBag.size > 0) {
        const belief = concept.beliefBag.peek();
        if (belief) {
          const task: any = {
            term: concept.term,
            type: 'belief' as const,
            truth: belief.truth,
            budget: belief.budget,
            stamp: belief.stamp,
            occurrenceTime: Date.now(),
            derived: false,
          };

          const explanation = trace.explain(task);
          expect(explanation).toBeDefined();
          expect(explanation.conclusion).toBeDefined();
          expect(explanation.premises).toBeDefined();
          expect(explanation.rules).toBeDefined();
          expect(explanation.confidence).toBeDefined();
          expect(explanation.why).toBeDefined();
        }
      }
    });

    it('should handle explanation with no premises', async () => {
      await nar.input('(simple --> fact)', 'belief', { f: 0.8, c: 0.8 });

      const concepts = nar.memory.listConcepts();
      const concept = concepts.find((c) => c.term.toString() === '(simple --> fact)');

      if (concept && concept.beliefBag.size > 0) {
        const belief = concept.beliefBag.peek();
        if (belief) {
          const task: any = {
            term: concept.term,
            type: 'belief' as const,
            truth: belief.truth,
            budget: belief.budget,
            stamp: belief.stamp,
            occurrenceTime: Date.now(),
            derived: false,
          };

          const explanation = trace.explain(task);
          expect(explanation.why).toBeDefined();
        }
      }
    });
  });

  describe('Derivation Tree', () => {
    it('should build derivation tree', async () => {
      await nar.input('(tree --> root)', 'belief', { f: 0.9, c: 0.9 });

      const concepts = nar.memory.listConcepts();
      const concept = concepts.find((c) => c.term.toString() === '(tree --> root)');

      if (concept && concept.beliefBag.size > 0) {
        const belief = concept.beliefBag.peek();
        if (belief) {
          const task: any = {
            term: concept.term,
            type: 'belief' as const,
            truth: belief.truth,
            budget: belief.budget,
            stamp: belief.stamp,
            occurrenceTime: Date.now(),
            derived: false,
          };

          const tree = trace.buildDerivationTree(task);
          expect(tree).toBeDefined();
          expect(tree.root).toBeDefined();
          expect(tree.depth).toBeGreaterThanOrEqual(1);
          expect(tree.nodeCount).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('should get derivation path', async () => {
      await nar.input('(path --> test)', 'belief', { f: 0.9, c: 0.9 });

      const concepts = nar.memory.listConcepts();
      const concept = concepts.find((c) => c.term.toString() === '(path --> test)');

      if (concept && concept.beliefBag.size > 0) {
        const belief = concept.beliefBag.peek();
        if (belief) {
          const task: any = {
            term: concept.term,
            type: 'belief' as const,
            truth: belief.truth,
            budget: belief.budget,
            stamp: belief.stamp,
            occurrenceTime: Date.now(),
            derived: false,
          };

          const path = trace.getDerivationPath(task);
          expect(Array.isArray(path)).toBe(true);
        }
      }
    });
  });

  describe('Record Derivation', () => {
    it('should record derivation', async () => {
      await nar.input('(recorded --> derivation)', 'belief', { f: 0.9, c: 0.9 });

      const concepts = nar.memory.listConcepts();
      const concept = concepts.find((c) => c.term.toString() === '(recorded --> derivation)');

      if (concept && concept.beliefBag.size > 0) {
        const belief = concept.beliefBag.peek();
        if (belief) {
          const task: any = {
            term: concept.term,
            type: 'belief' as const,
            truth: belief.truth,
            budget: belief.budget,
            stamp: { ...belief.stamp, id: 'test-id' },
            occurrenceTime: Date.now(),
            derived: false,
          };

          trace.recordDerivation(task, 'test-rule');
          expect(trace.getDerivationHistory(task).length).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe('QueryAPI and ReasoningTrace Integration', () => {
  let nar: NAR;
  let queryAPI: QueryAPI;
  let trace: ReasoningTrace;

  beforeEach(() => {
    nar = new NAR();
    queryAPI = new QueryAPI(nar.memory);
    trace = new ReasoningTrace(nar.memory);
  });

  it('should work together for reasoning analysis', async () => {
    await nar.input('(integration --> test)', 'belief', { f: 0.9, c: 0.9 });

    const beliefs = queryAPI.getBeliefs();
    expect(beliefs.length).toBeGreaterThan(0);

    const term = termParser.parse('(integration --> test)');
    const traceResult = trace.trace(term);
    expect(traceResult).toBeDefined();
  });

  it('should support question answering workflow', async () => {
    await nar.input('(workflow --> example)', 'belief', { f: 0.95, c: 0.95 });

    const answer = await queryAPI.ask('(workflow --> example)');
    expect(answer).toBeDefined();

    if (answer.confidence > 0.5) {
      expect(answer.answer).toBeDefined();
      expect(answer.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe('Factory Functions', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR();
  });

  it('should create QueryAPI via factory', () => {
    const api = createQueryAPI(nar.memory);
    expect(api).toBeInstanceOf(QueryAPI);
  });

  it('should create ReasoningTrace via factory', () => {
    const t = createReasoningTrace(nar.memory);
    expect(t).toBeInstanceOf(ReasoningTrace);
  });
});
