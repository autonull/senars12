/**
 * One-shot CLI: believe/ask/step with no browser (CORE.19 C7.1).
 *
 * Every other non-interactive mode reports *on* state; this one *runs* the
 * organism — feed beliefs and goals, advance cycles, and for a question print
 * the answer with its verified derivation when one exists. `--json` makes the
 * whole turn scriptable, which is what the acceptance walkthrough drives.
 *
 * Constructed through the bare kernel (`createNAR`), not `createAgentFromEnv`:
 * a one-shot has no session, dialogue or transport to wire, and D10 keeps the
 * path working with no LM configured.
 */

import { createNAR, type NAR } from '@senars/nar';
import { Truth } from '@senars/nar/terms';
import type { Flags } from '@senars/util';

/** The answer surface `askWithDerivation` returns, without a `./query` subpath. */
type Answer = Awaited<ReturnType<NAR['askWithDerivation']>>;

export interface OneShotRequest {
  beliefs: string[];
  goals: string[];
  questions: string[];
  steps: number;
  json: boolean;
}

/** The flags that select one-shot mode; presence of any is the trigger. */
const ONESHOT_FLAGS = ['--believe', '-b', '--ask', '-q', '--goal', '-g'] as const;

export const isOneShot = (flags: Flags): boolean => flags.has(...ONESHOT_FLAGS);

/**
 * Every value a repeatable flag was given, across its long and short spellings.
 * `Flags` keeps only the last value of a repeated flag, and a one-shot wants all
 * of them, so this scans the raw argv instead.
 */
const collectFlag = (flags: Flags, ...names: readonly string[]): string[] => {
  const { argv } = flags;
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    const eq = token.indexOf('=');
    const name = eq > 0 ? token.slice(0, eq) : token;
    if (!names.includes(name)) continue;
    if (eq > 0) {
      out.push(token.slice(eq + 1));
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('-')) {
      out.push(next);
      i++;
    }
  }
  return out.filter(Boolean);
};

export const readOneShot = (flags: Flags): OneShotRequest => ({
  beliefs: collectFlag(flags, '--believe', '-b'),
  goals: collectFlag(flags, '--goal', '-g'),
  questions: collectFlag(flags, '--ask', '-q'),
  steps: flags.num('--steps', 10),
  json: flags.has('--json'),
});

const renderAnswer = (question: string, answer: Answer): string => {
  if (!answer.answer) return `${question} => (no answer)`;
  const truth = answer.truth ? ` ${Truth.format(answer.truth, 3)}` : '';
  const steps = (answer.derivation?.record.steps ?? []).map(
    (step) => `  ${step.ruleId}: ${step.premises.join(' & ')} ⊢ ${step.conclusion}`
  );
  return [`${question} => ${answer.answer}${truth}`, ...steps].join('\n');
};

/** The serializable outcome of a one-shot run — what `--json` prints and a test asserts. */
export interface OneShotResult {
  beliefs: string[];
  goals: string[];
  steps: number;
  cycleCount: number;
  answers: Array<{
    question: string;
    answer: string | null;
    truth: { f: number; c: number } | null;
    derivation: Array<{ rule: string; premises: readonly string[]; conclusion: string }> | null;
  }>;
}

const toResult = (request: OneShotRequest, answers: Array<{ question: string; answer: Answer }>, cycleCount: number): OneShotResult => ({
  beliefs: request.beliefs,
  goals: request.goals,
  steps: request.steps,
  cycleCount,
  answers: answers.map(({ question, answer }) => ({
    question,
    answer: answer.answer ?? null,
    truth: answer.truth ? { f: answer.truth.f, c: answer.truth.c } : null,
    derivation:
      answer.derivation?.record.steps.map((step) => ({
        rule: step.ruleId,
        premises: step.premises,
        conclusion: step.conclusion,
      })) ?? null,
  })),
});

export async function runOneShot(request: OneShotRequest): Promise<OneShotResult> {
  const nar = createNAR({ persistState: false });
  await nar.start();
  try {
    for (const belief of request.beliefs) await nar.believe(belief);
    for (const goal of request.goals) await nar.goal(goal);
    if (request.steps > 0) await nar.run(request.steps);

    const answers: Array<{ question: string; answer: Answer }> = [];
    for (const question of request.questions) {
      const answer = await nar.askWithDerivation(question);
      answers.push({ question, answer });
      if (!request.json) console.log(renderAnswer(question, answer));
    }

    const result = toResult(request, answers, nar.getCycleCount());
    if (request.json) console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await nar.stop();
    await nar.dispose();
  }
}
