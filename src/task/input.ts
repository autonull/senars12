import { escapeRegExp, unique } from '@senars/util';
import type { Term } from '../terms';
import { Truth, termParser } from '../terms';
import { createTaskWeight, createTask, type Task, type TaskType } from '../types';
import { PUNCTUATION_BY_TASK_TYPE, taskTypeFromPunctuation } from './record.js';

export interface InputProcessorConfig {
  defaultType: TaskType;
}

const DEFAULT_CONFIG: InputProcessorConfig = {
  defaultType: 'belief',
};

/** The marks the grammar recognises as sentence punctuation — one source. */
const SENTENCE_MARKS = unique(Object.values(PUNCTUATION_BY_TASK_TYPE)).map(escapeRegExp).join('');

const SENTENCE_END = new RegExp(`^(.+?)([${SENTENCE_MARKS}])?\\s*$`);

function extractPunctuation(input: string): { text: string; punctuation: string } {
  const match = input.trim().match(SENTENCE_END);
  if (match) {
    return { text: match[1]!.trim(), punctuation: match[2] ?? '' };
  }
  return { text: input.trim(), punctuation: '' };
}

export class InputProcessor {
  private config: InputProcessorConfig;

  constructor(config: InputProcessorConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  process(input: string, type?: TaskType): Task {
    const { text, punctuation } = extractPunctuation(input);
    const { term, truth: parsedTruth } = termParser.parseWithTruth(text);
    const truth = parsedTruth ?? Truth.NEUTRAL; // system boundary — user input may lack truth
    return createTask(
      term,
      this.determineTaskType(punctuation, type),
      truth,
      createTaskWeight(Truth.attention(truth))
    );
  }

  processWithTruth(input: string, truth: Truth, type?: TaskType): Task {
    const { text, punctuation } = extractPunctuation(input);
    const { term } = termParser.parseWithTruth(text);
    return createTask(
      term,
      this.determineTaskType(punctuation, type),
      truth,
      createTaskWeight(Truth.attention(truth))
    );
  }

  parseTerm(input: string): Term {
    return termParser.parse(input);
  }

  detectType(input: string): TaskType {
    return this.determineTaskType(extractPunctuation(input).punctuation);
  }

  private determineTaskType(punctuation: string, type?: TaskType): TaskType {
    return type ?? taskTypeFromPunctuation(punctuation, this.config.defaultType);
  }
}

export const inputProcessor = new InputProcessor();
