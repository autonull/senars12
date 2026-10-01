import { describe, expect, it } from 'vitest';
import { createNAR, type NAR } from '@senars/nar';
import type { LMService } from '@senars/nar/lm';

/**
 * TODO29.a A1 — the four S/J/P configurations, as one gate.
 *
 * §2.6 claims the system reasons in all four; §1.2 claims the *core's* behaviour
 * is what matches across them. So the assertion is not "each configuration
 * works" — it is that the committed derivations are the same set in every one,
 * and that a hung `J` or `P` changes nothing about completion.
 *
 * No wall-clock assertions: a provider that never answers must not hang the
 * cycle, and "does not hang" is asserted by the call settling, not by a number.
 */

const NEVER = <T>(): Promise<T> => new Promise<T>(() => {});

const settling = async <T>(work: Promise<T>, ms: number): Promise<T | 'hung'> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'hung'>((resolve) => {
    timer = setTimeout(() => resolve('hung'), ms);
  });
  const outcome = await Promise.race([work, deadline]);
  clearTimeout(timer);
  return outcome;
};

const answeringLM = {
  tryGenerateText: async () => '(robin --> bird).',
  getStats: () => ({}),
  setProgressCallback: () => {},
} as unknown as LMService;

const hungLM = {
  tryGenerateText: () => NEVER<string>(),
  getStats: () => ({}),
  setProgressCallback: () => {},
} as unknown as LMService;

type Axis = { J: boolean; P: boolean; hung: boolean };

const build = async (axis: Axis): Promise<NAR> => {
  const nar = createNAR({
    lmService: axis.hung ? hungLM : answeringLM,
    enableLMRules: axis.P,
    systemOne: axis.J ? { enabled: true, judgeTimeoutMs: 50 } : { enabled: false },
    maxConcepts: 200,
  });
  await nar.initialize();
  return nar;
};

const episode = async (nar: NAR): Promise<string[]> => {
  await nar.input('(a --> b).');
  await nar.input('(b --> c).');
  for (let cycle = 0; cycle < 3; cycle++) {
    if ((await settling(nar.run(1), 5000)) === 'hung') return ['hung'];
  }
  return nar.query.getBeliefs().map((belief) => belief.term.toString()).sort();
};

const MATRIX: readonly (readonly [string, Axis])[] = [
  ['S', { J: false, P: false, hung: false }],
  ['S+J', { J: true, P: false, hung: false }],
  ['S+P', { J: false, P: true, hung: false }],
  ['S+J+P', { J: true, P: true, hung: false }],
];

describe('A1 — all four S/J/P configurations are complete systems', () => {
  it.each(MATRIX)('%s initialises and completes its cycles', async (_name, axis) => {
    const nar = await build(axis);
    await nar.input('(a --> b).');
    await nar.input('(b --> c).');
    for (let cycle = 0; cycle < 3; cycle++) {
      expect(await settling(nar.run(1), 5000)).not.toBe('hung');
    }
  });

  /**
   * `S`'s invariance is over the *core's* derivations, not over the whole
   * committed set: a model-backed rule's symbolic body may derive extra beliefs,
   * and those are attributed to a producer and applied at a boundary. What must
   * never happen is S losing a derivation because a producer existed.
   */
  it('a producer adds to the core\'s derivations and removes none of them', async () => {
    const [symbolic, withProposals] = await Promise.all([
      episode(await build({ J: false, P: false, hung: false })),
      episode(await build({ J: false, P: true, hung: false })),
    ]);

    expect(symbolic.length).toBeGreaterThan(0);
    expect(symbolic.filter((term) => !withProposals.includes(term))).toEqual([]);
    expect(withProposals.length).toBeGreaterThanOrEqual(symbolic.length);
  });
});

/**
 * The J axis is *configured* rather than functional in this tree: with System One
 * enabled and no calibrated heads, `SystemOneIngressJudge` abstains and the gate
 * refuses the observation. That is the fail-closed path working — the alternative
 * would be admitting unjudged input — but it means the four-way invariance claim
 * is asserted on the P axis here and on the J axis once a judge that admits
 * exists. Recorded in TODO29.a §0.8 as an open item, not asserted away.
 */
describe('A1 — a configured-but-uncalibrated J refuses rather than admits', () => {
  it('refuses ingress without hanging', async () => {
    const nar = await build({ J: true, P: false, hung: false });
    expect(await settling(nar.input('(robin --> bird).'), 5000)).not.toBe('hung');
    expect(nar.query.getBeliefs()).toEqual([]);
  });

  it('the same input without J is admitted', async () => {
    const nar = await build({ J: false, P: false, hung: false });
    await nar.input('(robin --> bird).');

    expect(nar.query.getBeliefs().length).toBeGreaterThan(0);
  });
});

describe('A1 — a hung provider is refused, not awaited', () => {
  it('a P backend that never answers commits what an answering one commits', async () => {
    const [answering, hung] = await Promise.all([
      episode(await build({ J: false, P: true, hung: false })),
      episode(await build({ J: false, P: true, hung: true })),
    ]);

    expect(hung).not.toEqual(['hung']);
    // Every rule declares a symbolic body, so the model answering or not is not
    // what decides what is committed — the body is.
    expect(hung).toEqual(answering);
  });

  it('a J judge that never answers refuses admission on its deadline', async () => {
    const nar = await build({ J: true, P: false, hung: true });

    expect(await settling(nar.input('(robin --> bird).'), 5000)).not.toBe('hung');
    expect(nar.query.getBeliefs()).toEqual([]);
  });
});
