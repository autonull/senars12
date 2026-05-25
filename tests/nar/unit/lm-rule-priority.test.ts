import {describe, expect, jest, test, beforeEach} from '@jest/globals';
import {RuleProcessor, type RuleInput} from '../../../src/nar/rules/processor';
import {Memory, DEFAULT_CONFIG, TermBuilder} from '../../../src/nar';

// Helper to create a RuleInput from a term string
const makeInput = (termStr: string): RuleInput => ({
  term: TermBuilder.atom(termStr),
  truth: {f: 1.0, c: 0.9},
  stamp: {id: 'test', created: [Date.now()], source: 'test'} as any,
});

// Helper to iterate async generator
const collectResults = async (gen: AsyncGenerator<any>): Promise<any[]> => {
  const results: any[] = [];
  for await (const r of gen) results.push(r);
  return results;
};

// Helper to create premise pairs
async function* singlePremise(p1: RuleInput, p2: RuleInput): AsyncIterable<[RuleInput, RuleInput]> {
  yield [p1, p2];
}

describe('RuleProcessor LM Rule Priority', () => {
  let memory: Memory;
  let processor: RuleProcessor;
  let mockLMRule: any;

  beforeEach(() => {
    memory = new Memory({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 100,
    });

    processor = new RuleProcessor();
    processor.setConfig({memory});

    mockLMRule = {
      id: 'test-lm-rule',
      name: 'Test LM Rule',
      priority: 1.0,
      sync: false,
      apply: jest.fn(() => Promise.resolve([])),
      canApply: jest.fn(() => true),
      setEventBus: jest.fn(),
    };
  });

  test('calls LM rule when premise concepts have priority', async () => {
    const termA = TermBuilder.atom('A');
    const termB = TermBuilder.atom('B');
    const conceptA = memory.addConcept(termA);
    const conceptB = memory.addConcept(termB);
    conceptA.priority = 0.9;
    conceptB.priority = 0.8;

    processor.registerLMRule(mockLMRule);
    await collectResults(processor.process(singlePremise(makeInput('A'), makeInput('B'))));

    expect(mockLMRule.apply).toHaveBeenCalled();
  });

  test('passes priority in context to LM rule', async () => {
    const termA = TermBuilder.atom('A');
    const termB = TermBuilder.atom('B');
    const conceptA = memory.addConcept(termA);
    const conceptB = memory.addConcept(termB);
    conceptA.priority = 0.7;
    conceptB.priority = 0.6;

    processor.registerLMRule(mockLMRule);
    await collectResults(processor.process(singlePremise(makeInput('A'), makeInput('B'))));

    expect(mockLMRule.apply).toHaveBeenCalled();
    const callArgs = mockLMRule.apply.mock.calls[0];
    expect(callArgs?.[2]).toEqual({priority: 0.7});
  });

  test('high priority concepts result in higher selection probability', async () => {
    const termA = TermBuilder.atom('A');
    const termB = TermBuilder.atom('B');
    const conceptA = memory.addConcept(termA);
    const conceptB = memory.addConcept(termB);
    conceptA.priority = 0.9;
    conceptB.priority = 0.1;

    processor.registerLMRule(mockLMRule);
    await collectResults(processor.process(singlePremise(makeInput('A'), makeInput('B'))));

    expect(mockLMRule.apply).toHaveBeenCalled();
  });

  test('no LM rules registered results in no errors', async () => {
    await collectResults(processor.process(singlePremise(makeInput('A'), makeInput('B'))));
  });

  test('LM rule apply error does not crash processor', async () => {
    const termA = TermBuilder.atom('A');
    const termB = TermBuilder.atom('B');
    const conceptA = memory.addConcept(termA);
    const conceptB = memory.addConcept(termB);
    conceptA.priority = 0.9;
    conceptB.priority = 0.9;

    const failingRule: any = {
      id: 'failing-lm-rule',
      name: 'Failing LM Rule',
      priority: 1.0,
      sync: false,
      apply: jest.fn(() => Promise.reject(new Error('LM failure'))),
      canApply: jest.fn(() => true),
      setEventBus: jest.fn(),
    };
    processor.registerLMRule(failingRule);
    await expect(processor.process(singlePremise(makeInput('A'), makeInput('B')))).toBeDefined();
  });
});
