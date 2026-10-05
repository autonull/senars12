import {
  DetectedIntentSchema,
  DETECTED_INTENTS,
  TASK_BAG_KINDS,
  TASK_TYPES,
} from '@senars/core/schemas';
import { describe, expect, it } from 'vitest';
import {
  asRubricId,
  COGNITIVE_AXES,
  cognitiveAxisSchema,
  DECISION_AXES,
  DECISION_POSITIONS,
  RUBRIC_IDS,
  rubricIdSchema,
  SYNTHESIS_AXIS,
} from '../../../nar/src/decision/index.js';
import { ALL_HEAD_SPECS, HEAD_SPECS } from '../../../nar/src/lm/system-one/head-ontology.js';
import { TaskBatchSchema } from '../../../nar/src/lm/rule-templates/schemas.js';

/**
 * A vocabulary that is declared twice is a vocabulary that has already drifted.
 *
 * `RubricId` was a hand-written nineteen-member union with no value-level
 * counterpart, so `asRubricId` had to answer membership from the head table instead
 * and cast — the compiler could not tell whether the two lists agreed, and
 * `HEAD_SPECS` was typed `Record<string, HeadSpec>`, which is how a rubric with no
 * head could be added without an error. The decision manifest separately restated
 * the axes and the positions, and `detectedIntent` existed as two unrelated inline
 * `z.enum`s. Each of those is now declared once and derived everywhere else.
 */

describe('judgment vocabulary', () => {
  it('names every rubric once, and every rubric has a head', () => {
    expect(new Set(RUBRIC_IDS).size).toBe(RUBRIC_IDS.length);
    expect(Object.keys(HEAD_SPECS).sort()).toEqual([...RUBRIC_IDS].sort());
    expect([...ALL_HEAD_SPECS].map((s) => s.rubric).sort()).toEqual([...RUBRIC_IDS].sort());
  });

  it('narrows a free-text name to the vocabulary rather than casting it', () => {
    for (const rubric of RUBRIC_IDS) {
      expect(asRubricId(rubric)).toBe(rubric);
      expect(rubricIdSchema.safeParse(rubric).success).toBe(true);
    }
    expect(asRubricId('not_a_rubric')).toBeUndefined();
    expect(asRubricId('')).toBeUndefined();
    expect(rubricIdSchema.safeParse('not_a_rubric').success).toBe(false);
  });

  it('the task_type head classifies over the task vocabulary, not a copy of it', () => {
    expect(HEAD_SPECS.task_type.space).toBe(TASK_TYPES);
  });
});

describe('decision manifest vocabulary', () => {
  it('derives the axes from the firewall pair plus the one axis outside it', () => {
    expect(COGNITIVE_AXES).toEqual(['epistemic', 'teleological']);
    expect(DECISION_AXES).toEqual([...COGNITIVE_AXES, SYNTHESIS_AXIS]);
    expect(new Set(DECISION_AXES).size).toBe(DECISION_AXES.length);
  });

  it('positions are the port’s own list, not a second literal', () => {
    expect(DECISION_POSITIONS).toEqual(['cycle', 'boundary']);
  });

  it('the axis schemas agree with the axis tuples', () => {
    for (const axis of COGNITIVE_AXES)
      expect(cognitiveAxisSchema.safeParse(axis).success).toBe(true);
    expect(cognitiveAxisSchema.safeParse(SYNTHESIS_AXIS).success).toBe(false);
  });
});

describe('detected intent', () => {
  it('one list for the formalization batch and the rule-template generator', () => {
    expect(DETECTED_INTENTS).toEqual(['chat', 'command', 'reasoning', 'learning']);
    for (const intent of DETECTED_INTENTS) {
      expect(DetectedIntentSchema.safeParse(intent).success).toBe(true);
      expect(
        TaskBatchSchema.shape.meta.safeParse({
          detectedIntent: intent,
          ambiguities: [],
          coreferences: [],
          implicitContext: [],
        }).success
      ).toBe(true);
    }
  });

  it('rejects an intent neither declares', () => {
    expect(DetectedIntentSchema.safeParse('smalltalk').success).toBe(false);
  });
});

describe('bag vocabulary', () => {
  it('the store walk reads the bags the kernel declares', () => {
    expect(TASK_BAG_KINDS).toEqual(['belief', 'goal', 'question']);
    expect(TASK_BAG_KINDS.every((kind) => TASK_TYPES.includes(kind))).toBe(true);
  });
});
