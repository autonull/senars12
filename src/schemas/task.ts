import { z } from 'zod';

/**
 * The task vocabulary — what kind of claim a task makes, and the Narsese sentence
 * mark that kind is written with.
 *
 * Bottom of the schema layer, because every other kernel contract needs it: the
 * admitted-event payload, the content proposal, the rule table and the formalization
 * batch each name a task kind, and the chat/graph wire schemas carry its punctuation.
 * Those were four inline `z.enum(['belief', 'goal', 'question', 'command'])` literals
 * and three `z.enum(['.', '!', '?'])` literals, which is how a `command` task came to
 * be unexpressible in the formalization batch and in all three wire schemas while being
 * the fourth member of the union everywhere else.
 */

/** Every kind of task the kernel admits. Order is the bag order, not a ranking. */
export const TASK_TYPES = ['belief', 'goal', 'question', 'command'] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TaskTypeSchema = z.enum(TASK_TYPES);

/**
 * The kinds a concept's bags can hold. `command` is admitted and rendered but never
 * stored as a belief or a goal, so it is a task kind and not a bag kind — declared
 * against the type so that adding a fifth task forces a decision here.
 */
export const TASK_BAG_KINDS = ['belief', 'goal', 'question'] as const satisfies readonly TaskType[];

export type TaskBagKind = (typeof TASK_BAG_KINDS)[number];

export const TaskBagKindSchema = z.enum(TASK_BAG_KINDS);

/**
 * The sentence mark a task of each kind is written with — the one place the grammar's
 * punctuation and the wire schemas' punctuation are the same fact. `'@'` is the
 * grammar's QUEST mark and is deliberately absent: it is not a task type, so a task
 * rendered here parses back through the term parser as the kind it was written as.
 */
export const TASK_PUNCTUATION = {
  belief: '.',
  goal: '!',
  question: '?',
  command: ';',
} as const satisfies Readonly<Record<TaskType, string>>;

export type TaskPunctuation = (typeof TASK_PUNCTUATION)[TaskType];

/** The marks, deduplicated from the table above rather than restated. */
export const TASK_PUNCTUATIONS = [
  ...new Set<TaskPunctuation>(Object.values(TASK_PUNCTUATION)),
].sort();

export const TaskPunctuationSchema = z.enum(TASK_PUNCTUATIONS);

/**
 * The order a string observation is re-parsed in when it arrived with no sentence mark:
 * bare, then the three statement marks. `;` is absent, so an unmarked observation is
 * never read as a command — the caller writes the mark it means. The term layer's
 * `parseTaskTolerant` is its one reader: the perception gate admits what it parses and the
 * NL router asks the same question before claiming an utterance is Narsese, and both
 * answers came from this list rather than from a restatement of it.
 */
export const TOLERANT_PUNCTUATIONS = ['', '.', '?', '!'] as const satisfies readonly (
  | ''
  | TaskPunctuation
)[];

const TASK_TYPE_BY_PUNCTUATION: ReadonlyMap<string, TaskType> = new Map(
  Object.entries(TASK_PUNCTUATION).map(([type, mark]) => [mark, type as TaskType])
);

/** Task kind named by its Narsese sentence mark; `null` when it is not one. */
export const taskTypeForPunctuation = (punctuation: string): TaskType | null =>
  TASK_TYPE_BY_PUNCTUATION.get(punctuation) ?? null;
