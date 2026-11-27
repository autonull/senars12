import { Truth } from '../terms';
import { createTask, createTaskWeight } from '../types';
import { LMResponseParser, LMRule } from './LMRule';
const NARSESE_INSTRUCTIONS = `
You are a reasoning assistant that responds in Narsese format.
Use these Narsese operators:
- inheritance: (A --> B) means "A is a kind of B"
- similarity: (A <-> B) means "A is similar to B"
- implication: (A => B) means "if A then B"
- equivalence: (A <=> B) means "A if and only if B"
- conjunction: (A & B) means "both A and B"
- disjunction: (A | B) means "either A or B"

Respond with a single Narsese statement or JSON:
{"narsese": "(A --> B)", "truth": {"f": 0.8, "c": 0.9}}
`.trim();
const responseToTask = (response, type, budget) => {
    if (!response)
        return createTask({ kind: 'atom', symbol: 'TRUE' }, type, Truth.NEUTRAL, createTaskWeight(budget));
    const parsed = LMResponseParser.parse(response);
    return parsed.valid && parsed.term
        ? createTask(parsed.term, type, parsed.truth, createTaskWeight(budget))
        : createTask({ kind: 'atom', symbol: response.trim() }, type, Truth.NEUTRAL, createTaskWeight(budget));
};
const parseResponse = (response, type, budget) => {
    if (!response)
        return [];
    return response
        .split('\n')
        .filter((l) => l.trim())
        .map((line) => responseToTask(line, type, budget));
};
const createTaskGen = (type, budget) => (_r, _p) => {
    const response = typeof _r === 'string' ? _r : String(_r);
    return [responseToTask(response, type, budget)];
};
const asUnknownCondition = (fn) => fn
    ? (p, s, c) => fn(p, s, c)
    : undefined;
const createCustomRule = (id, lm, config) => {
    const taskType = config.taskType ?? 'belief';
    const budget = config.budget ?? 0.7;
    return new LMRule(id, lm, {
        name: config.name ?? id,
        description: config.description ?? 'Custom LM rule',
        priority: config.priority ?? 0.8,
        singlePremise: config.singlePremise ?? true,
        activationCondition: asUnknownCondition(config.activationCondition),
        promptTemplate: config.promptTemplate ?? `Reason about: {{primaryTerm}}`,
        fallback: (config.fallback ?? (() => null)),
        taskGenerator: config.multiline
            ? (r) => parseResponse(String(r), taskType, budget)
            : createTaskGen(taskType, budget),
    });
};
const createRule = (lm, def, config = {}) => {
    const taskType = def.taskType ?? 'belief';
    const budget = def.budget ?? 0.7;
    return new LMRule(def.id, lm, {
        ...config,
        name: def.name,
        description: def.description,
        priority: def.priority,
        singlePremise: def.singlePremise ?? true,
        activationCondition: asUnknownCondition(config.activationCondition ?? def.activationCondition),
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\n${def.prompt}`,
        taskType,
        outputSchema: def.schema,
        enableTools: def.enableTools,
        constitutionAware: def.constitutionAware,
        grammar: def.grammar,
        maxOutputTokens: def.maxOutputTokens,
        fallback: (config.fallback ?? def.fallback),
        taskGenerator: def.multiline
            ? (r) => parseResponse(String(r), taskType, budget)
            : createTaskGen(taskType, budget),
    });
};
export { createCustomRule, createRule, createTaskGen, NARSESE_INSTRUCTIONS, parseResponse };
