import { describe, expect, it } from 'vitest';
import { InputProcessor } from '../../../nar/src/task/input.js';
import {
  PUNCTUATION_BY_TASK_TYPE,
  rehydrateTask,
  serializeTaskRecord,
  taskTypeFromPunctuation,
} from '../../../nar/src/task/record.js';
import { Truth, termParser } from '../../../nar/src/terms/index.js';
import { createBudget, createTask } from '../../../nar/src/types/index.js';

const term = (source: string) => termParser.parse(source);

describe('taskTypeFromPunctuation', () => {
  it('reads the type a sentence mark names', () => {
    expect(taskTypeFromPunctuation('.', 'goal')).toBe('belief');
    expect(taskTypeFromPunctuation('!', 'belief')).toBe('goal');
    expect(taskTypeFromPunctuation('?', 'belief')).toBe('question');
    expect(taskTypeFromPunctuation(';', 'belief')).toBe('command');
  });

  it('falls back rather than guessing for an unrecognised mark', () => {
    expect(taskTypeFromPunctuation('@', 'belief')).toBe('belief');
    expect(taskTypeFromPunctuation('', 'question')).toBe('question');
  });

  it('agrees with the grammar that reads these marks', () => {
    for (const [type, mark] of Object.entries(PUNCTUATION_BY_TASK_TYPE)) {
      expect(termParser.parseTask(`(a --> b)${mark}`)?.taskType).toBe(type);
    }
  });

  it('round-trips every type through the punctuation table', () => {
    for (const [type, mark] of Object.entries(PUNCTUATION_BY_TASK_TYPE)) {
      expect(taskTypeFromPunctuation(mark, 'belief')).toBe(type);
    }
  });
});

describe('InputProcessor task typing', () => {
  const processor = new InputProcessor();

  it('detectType and process agree on every mark', () => {
    for (const [type, mark] of Object.entries(PUNCTUATION_BY_TASK_TYPE)) {
      expect(processor.detectType(`(a --> b)${mark}`)).toBe(type);
      expect(processor.process(`(a --> b)${mark}`).type).toBe(type);
    }
  });

  it('honours the configured default when the mark is absent', () => {
    expect(new InputProcessor({ defaultType: 'question' }).detectType('(a-->b)')).toBe(
      'question'
    );
  });

  it('an explicit type overrides the mark', () => {
    expect(processor.process('(a-->b)!', 'belief').type).toBe('belief');
  });
});

describe('rehydrateTask', () => {
  it('restores term, type, truth, and budget', () => {
    const task = rehydrateTask({
      term: '(cat-->animal)',
      type: 'belief',
      truth: { f: 0.9, c: 0.8 },
      budget: 0.7,
    });

    expect(task?.term.toString()).toBe('(cat-->animal)');
    expect(task?.type).toBe('belief');
    expect(task?.truth).toEqual(Truth.create(0.9, 0.8));
    expect(task?.budget.priority).toBe(0.7);
  });

  it('uses the fallback type only when the record carries none', () => {
    expect(rehydrateTask({ term: 'a' }, 'question')?.type).toBe('question');
    expect(rehydrateTask({ term: 'a', type: 'goal' }, 'question')?.type).toBe('goal');
  });

  it('neutral truth and neutral budget for the fields a record omits', () => {
    const task = rehydrateTask({ term: 'a' });

    expect(task?.truth).toEqual(Truth.NEUTRAL);
    expect(task?.budget).toEqual(createBudget(0.5));
  });

  it('a non-finite budget falls back instead of poisoning the bag', () => {
    expect(rehydrateTask({ term: 'a', budget: Number.NaN })?.budget.priority).toBe(0.5);
    expect(rehydrateTask({ term: 'a', budget: Number.POSITIVE_INFINITY })?.budget.priority).toBe(
      0.5
    );
  });

  it('returns null for a term that no longer parses, rather than throwing', () => {
    expect(rehydrateTask({ term: '(a --> ' })).toBeNull();
    expect(rehydrateTask({ term: '' })).toBeNull();
  });

  it('a restored stamp keeps its id and lineage', () => {
    const original = createTask(term('a'), 'belief', Truth.NEUTRAL, createBudget(0.5), {
      stamp: { id: 'seed', creationTime: 0 as never, source: 'INPUT', derivations: ['parent'] },
    });

    const restored = rehydrateTask(serializeTaskRecord(original));

    expect(restored?.stamp.id).toBe('seed');
    expect(restored?.stamp.derivations).toEqual(['parent']);
  });

  it('preserves the occurrence time so a replayed task is not aged to now', () => {
    const original = createTask(term('a'), 'belief', Truth.NEUTRAL, createBudget(0.5), {
      occurrenceTime: 1234 as never,
    });

    expect(rehydrateTask(serializeTaskRecord(original))?.occurrenceTime).toBe(1234);
  });
});

describe('serializeTaskRecord', () => {
  it('round-trips a task through the record unchanged', () => {
    const original = createTask(
      term('(a-->b)'),
      'goal',
      Truth.create(0.7, 0.6),
      createBudget(0.42),
      {
        occurrenceTime: 99 as never,
      }
    );

    const restored = rehydrateTask(serializeTaskRecord(original));

    expect(restored?.term.toString()).toBe(original.term.toString());
    expect(restored?.type).toBe(original.type);
    expect(restored?.truth).toEqual(original.truth);
    expect(restored?.budget.priority).toBe(original.budget.priority);
    expect(restored?.occurrenceTime).toBe(original.occurrenceTime);
  });

  it('records the priority, not the whole budget', () => {
    const record = serializeTaskRecord(
      createTask(term('a'), 'belief', Truth.NEUTRAL, createBudget(0.3, 0.1, 0.2))
    );

    expect(record.budget).toBe(0.3);
  });
});
