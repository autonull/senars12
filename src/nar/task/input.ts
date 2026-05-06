import { termParser } from '../terms/parser.js';
import { Truth } from '../terms/truth.js';
import { createTask, createBudget, type Task, type TaskType } from './task.js';
import type { Term } from '../terms/types.js';

export interface InputProcessorConfig {
  defaultType: TaskType;
}

const DEFAULT_CONFIG: InputProcessorConfig = {
  defaultType: 'belief'
};

function extractPunctuation(input: string): { text: string; punctuation: string } {
  const match = input.trim().match(/^(.+?)([.!?@])?\s*$/);
  if (match) {
    return { text: match[1]!.trim(), punctuation: match[2] || '.' };
  }
  return { text: input.trim(), punctuation: '.' };
}

export class InputProcessor {
  private config: InputProcessorConfig;

  constructor(config: InputProcessorConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  process(input: string, type?: TaskType): Task {
    const { text, punctuation } = extractPunctuation(input);
    const { term, truth: parsedTruth } = termParser.parseWithTruth(text);

    let taskType = type ?? this.config.defaultType;
    if (punctuation === '?') {
      taskType = 'question';
    } else if (punctuation === '!') {
      taskType = 'goal';
    } else if (punctuation === '@') {
      taskType = 'command';
    }

    const truth = parsedTruth ?? Truth.NEUTRAL;
    const task = createTask(term, taskType, truth, createBudget(truth.f * truth.c));

    return task;
  }

  processWithTruth(input: string, truth: Truth, type?: TaskType): Task {
    const { text, punctuation } = extractPunctuation(input);
    const { term } = termParser.parseWithTruth(text);

    let taskType = type ?? this.config.defaultType;
    if (punctuation === '?') {
      taskType = 'question';
    } else if (punctuation === '!') {
      taskType = 'goal';
    } else if (punctuation === '@') {
      taskType = 'command';
    }

    return createTask(term, taskType, truth, createBudget(truth.f * truth.c));
  }

  parseTerm(input: string): Term {
    return termParser.parse(input);
  }

  detectType(input: string): TaskType {
    const { punctuation } = extractPunctuation(input);

    if (punctuation === '?') return 'question';
    if (punctuation === '!') return 'goal';
    if (punctuation === '@') return 'command';

    return 'belief';
  }
}

export const inputProcessor = new InputProcessor();
