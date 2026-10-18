import type { CognitiveEvent, EventLog } from '@senars/core/eventlog';
import { InMemoryEventLog, queryEventStream } from '@senars/core/eventlog';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const TRUTH = { frequency: 0.9, confidence: 0.8 };

type Appendable = Omit<CognitiveEvent, 'id' | 'timestamp'>;

const append = (log: EventLog, event: Appendable): Promise<CognitiveEvent> => log.append(event);

const user = (text: string): Appendable => ({
  engine: 'nar',
  type: 'input.user',
  correlationId: `cid-${text}`,
  payload: { text, source: 'test' },
});

const belief = (term: string): Appendable => ({
  engine: 'nar',
  type: 'belief.added',
  correlationId: `cid-${term}`,
  payload: { term, truth: TRUTH },
});

const accepted = (conclusion: string, premises: string[], cycle: number): Appendable => ({
  engine: 'nar',
  type: 'derivation.accepted',
  correlationId: `cid-${conclusion}`,
  payload: {
    derivationId: '00000000-0000-0000-0000-000000000000',
    ruleId: 'deduction',
    premises,
    conclusion,
    truth: TRUTH,
    evidenceLineage: [],
    independenceCheck: 'independent',
    cycle,
  },
});

describe('queryEventStream (CORE.19 C1.5)', () => {
  let log: InMemoryEventLog;

  beforeEach(() => {
    log = new InMemoryEventLog();
  });

  afterEach(async () => {
    await log.close();
  });

  it('pushes the type filter down and returns the matches in id order', async () => {
    await append(log, user('a'));
    await append(log, belief('t1'));
    await append(log, belief('t2'));

    const beliefs = await queryEventStream(log, { types: ['belief.added'] });
    expect(beliefs.map((e) => e.type)).toEqual(['belief.added', 'belief.added']);
  });

  it('narrows by the kernel cycle a fire belongs to', async () => {
    await append(log, accepted('c1', ['a', 'b'], 1));
    await append(log, accepted('c2', ['b', 'c'], 2));

    const cycle1 = await queryEventStream(log, { cycle: 1 });
    expect(cycle1).toHaveLength(1);
    expect(cycle1[0]!.type).toBe('derivation.accepted');
  });

  it('narrows by a term an event names, in any declared slot', async () => {
    await append(log, belief('penguin'));
    await append(
      log,
      accepted('(penguin --> bird)', ['(penguin --> animal)', '(animal --> bird)'], 1)
    );

    const byConcept = await queryEventStream(log, { term: 'penguin' });
    expect(byConcept).toHaveLength(1);

    const byPremise = await queryEventStream(log, { term: '(animal --> bird)' });
    expect(byPremise).toHaveLength(1);
    expect((byPremise[0]!.payload as { conclusion: string }).conclusion).toBe('(penguin --> bird)');
  });

  it('caps after a payload filter rather than before it', async () => {
    for (let i = 0; i < 5; i++) await append(log, accepted(`c${i}`, ['x', 'y'], i));

    const limited = await queryEventStream(log, { cycle: 3, limit: 1 });
    expect(limited).toHaveLength(1);
  });
});
