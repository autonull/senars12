import {
  ChatMessage,
  GraphNodeDataView,
  NarConceptNode,
} from '@senars/core/protocol';
import {
  FormalizationBatchSchema,
  FormalizationCandidateSchema,
  TASK_BAG_KINDS,
  TASK_PUNCTUATION,
  TASK_PUNCTUATIONS,
  TASK_TYPES,
  TaskTypeSchema,
  TOLERANT_PUNCTUATIONS,
  taskTypeForPunctuation,
} from '@senars/core/schemas';
import { describe, expect, it } from 'vitest';

/**
 * The task vocabulary — the kind of claim and its sentence mark — is one table,
 * and every kernel contract that names either derives from it.
 *
 * The four-kind union used to be written out as an inline `z.enum` in four core
 * schemas, and the punctuation as `z.enum(['.', '!', '?'])` in three wire schemas.
 * That is how a `command` task came to be the fourth member of the union everywhere
 * except the formalization batch, which rejected it, and the three wire schemas,
 * which had no mark to carry it with: the formalize → propose path could not express
 * a command, and a command task was unrepresentable on the chat and graph channels.
 * The bag set is a genuine subset — `command` is admitted and rendered but never
 * stored — so it is declared against the task type rather than written out again.
 */
const formalizationCandidate = (taskType: string) => ({
  candidateId: '00000000-0000-4000-8000-000000000000',
  narsese: '-->.',
  taskType,
  confidence: 0.5,
  sourceSpans: [{ start: 0, end: 1, text: 'x' }],
  ambiguityFlags: [],
});

const conceptNode = (punctuation: string) => ({
  nodeType: 'nar:concept',
  term: 'a',
  priority: 0.5,
  confidence: 0.5,
  punctuation,
});

const chatMessage = (punctuation: string) => ({
  id: 'm1',
  role: 'user',
  content: '',
  timestamp: 0,
  punctuation,
  parentId: null,
  threadRootId: 'r1',
  supports: [],
  contradicts: [],
  derivesFrom: [],
});

describe('task vocabulary', () => {
  it.each(TASK_TYPES)('admits a %s task everywhere a task kind is named', (taskType) => {
    expect(TaskTypeSchema.safeParse(taskType).success).toBe(true);
    expect(FormalizationCandidateSchema.safeParse(formalizationCandidate(taskType)).success).toBe(
      true
    );
    expect(
      FormalizationBatchSchema.safeParse({
        batchId: '00000000-0000-4000-8000-000000000001',
        sourceText: 'x',
        candidates: [formalizationCandidate(taskType)],
      }).success
    ).toBe(true);
  });

  it.each(TASK_TYPES)('renders a %s task with the mark the grammar gives it', (taskType) => {
    const mark = TASK_PUNCTUATION[taskType];
    expect(TASK_PUNCTUATIONS).toContain(mark);
    expect(taskTypeForPunctuation(mark)).toBe(taskType);
    expect(ChatMessage.safeParse(chatMessage(mark)).success).toBe(true);
    expect(NarConceptNode.safeParse(conceptNode(mark)).success).toBe(true);
    expect(GraphNodeDataView.safeParse({ ...conceptNode(mark), nodeType: 'nar:concept' }).success)
      .toBe(true);
  });

  it('rejects a mark that is no task kind\'s mark', () => {
    expect(taskTypeForPunctuation('@')).toBeNull();
    expect(ChatMessage.safeParse(chatMessage('@')).success).toBe(false);
  });

  it('stores every kind but `command`, and admits all four', () => {
    expect(TASK_BAG_KINDS.every((kind) => TASK_TYPES.includes(kind))).toBe(true);
    expect(TASK_BAG_KINDS).not.toContain('command');
    expect(TASK_TYPES.length).toBe(TASK_BAG_KINDS.length + 1);
  });

  it('tolerates only marks that are a task kind\'s mark or none at all', () => {
    expect(TOLERANT_PUNCTUATIONS[0]).toBe('');
    for (const mark of TOLERANT_PUNCTUATIONS.slice(1)) {
      expect(taskTypeForPunctuation(mark)).not.toBeNull();
    }
  });
});