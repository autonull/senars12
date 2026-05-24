import type {Term} from '../terms';
import {termParser, Truth} from '../terms';
import {createBudget, createTask, type Task, type TaskType} from '../types';

export interface InputProcessorConfig {
    defaultType: TaskType;
}

const DEFAULT_CONFIG: InputProcessorConfig = {
    defaultType: 'belief'
};

function extractPunctuation(input: string): { text: string; punctuation: string } {
    const match = input.trim().match(/^(.+?)([.!?@])?\s*$/);
    if (match) {
        return {text: match[1]!.trim(), punctuation: match[2] || '.'};
    }
    return {text: input.trim(), punctuation: '.'};
}

export class InputProcessor {
    private config: InputProcessorConfig;

    constructor(config: InputProcessorConfig = DEFAULT_CONFIG) {
        this.config = config;
    }

    process(input: string, type?: TaskType): Task {
        const {text, punctuation} = extractPunctuation(input);
        const {term, truth: parsedTruth} = termParser.parseWithTruth(text);
        const truth = parsedTruth ?? Truth.NEUTRAL; // system boundary — user input may lack truth
        return createTask(term, this.determineTaskType(punctuation, type), truth, createBudget(truth.f * truth.c));
    }

    processWithTruth(input: string, truth: Truth, type?: TaskType): Task {
        const {text, punctuation} = extractPunctuation(input);
        const {term} = termParser.parseWithTruth(text);
        return createTask(term, this.determineTaskType(punctuation, type), truth, createBudget(truth.f * truth.c));
    }

    parseTerm(input: string): Term {
        return termParser.parse(input);
    }

    detectType(input: string): TaskType {
        const {punctuation} = extractPunctuation(input);

        if (punctuation === '?') return 'question';
        if (punctuation === '!') return 'goal';
        if (punctuation === '@') return 'command';

        return 'belief';
    }

    private determineTaskType(punctuation: string, type?: TaskType): TaskType {
        if (type) return type;
        if (punctuation === '?') return 'question';
        if (punctuation === '!') return 'goal';
        if (punctuation === '@') return 'command';
        return this.config.defaultType;
    }
}

export const inputProcessor = new InputProcessor();
