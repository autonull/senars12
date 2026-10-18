/**
 * One-shot CLI: feed Narsese, step, and read answers with no browser (CORE.19 C7.1).
 *
 * Input is positional Narsese — no flag, because there is nothing to name: a
 * sentence's trailing punctuation *is* its task type (`.` belief, `!` goal, `?`
 * question), and one argument may carry several sentences. `-b`/`-g`/`-q` would
 * have re-declared what the mark already says, so the runner infers the type and
 * only answers the questions.
 *
 * Constructed through the bare kernel (`createNAR`), not `createAgentFromEnv`:
 * a one-shot has no session, dialogue or transport to wire, and D10 keeps the
 * path working with no LM configured.
 */

import { createNAR, type NAR } from '@senars/nar';
import { PUNCTUATION_BY_TASK_TYPE, taskTypeForPunctuation, Truth } from '@senars/nar/terms';
import { escapeRegExp, type Flags } from '@senars/util';

/** The answer surface `askWithDerivation` returns, without a `./query` subpath. */
type Answer = Awaited<ReturnType<NAR['askWithDerivation']>>;

export interface OneShotRequest {
  /** Narsese sentences; each sentence's punctuation selects its task type. */
  inputs: string[];
  steps: number;
  json: boolean;
}

/**
 * The grammar's one mark set (`PUNCTUATION_BY_TASK_TYPE`), read as a character
 * class — never a second `[.!?]` literal that could drift from it.
 */
const MARKS = Object.values(PUNCTUATION_BY_TASK_TYPE).map(escapeRegExp).join('');
const TASK_END = new RegExp(`(?<=[${MARKS}])\\s+`);
const TRAILING_MARK = new RegExp(`([${MARKS}])\\s*$`);

/** One argument may hold several sentences; a task ends at its punctuation mark. */
const splitTasks = (text: string): string[] =>
  text
    .split(TASK_END)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

/** The sentence's task type, from the one punctuation source; bare input is a belief. */
const typeOf = (sentence: string) =>
  taskTypeForPunctuation(TRAILING_MARK.exec(sentence.trim())?.[1] ?? '') ?? 'belief';

/** A one-shot is any invocation with positional Narsese and no reporting-mode flag. */
export const isOneShot = (flags: Flags): boolean =>
  flags.positional.length > 0 && !flags.has('--help', '-h');

export const readOneShot = (flags: Flags): OneShotRequest => ({
  inputs: flags.positional.flatMap(splitTasks),
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
  inputs: string[];
  steps: number;
  cycleCount: number;
  answers: Array<{
    question: string;
    answer: string | null;
    truth: { f: number; c: number } | null;
    derivation: Array<{ rule: string; premises: readonly string[]; conclusion: string }> | null;
  }>;
}

const toResult = (
  request: OneShotRequest,
  answers: Array<{ question: string; answer: Answer }>,
  cycleCount: number
): OneShotResult => ({
  inputs: request.inputs,
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
    for (const sentence of request.inputs) await nar.input(sentence, typeOf(sentence));
    if (request.steps > 0) await nar.run(request.steps);

    const answers: Array<{ question: string; answer: Answer }> = [];
    for (const sentence of request.inputs) {
      if (typeOf(sentence) !== 'question') continue;
      const answer = await nar.askWithDerivation(sentence);
      answers.push({ question: sentence, answer });
      if (!request.json) console.log(renderAnswer(sentence, answer));
    }

    const result = toResult(request, answers, nar.getCycleCount());
    if (request.json) console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await nar.stop();
    await nar.dispose();
  }
}
