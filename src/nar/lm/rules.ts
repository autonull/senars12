import {LMRule} from './LMRule.js';
import type {LMClient, LMRuleConfig} from './types.js';
import type {Term} from '../terms';
import {Truth} from '../terms';
import {createBudget, createTask, type Task, type TaskType} from '../types';
import {LMResponseParser} from './parser.js';

interface LMRuleDefinition {
    id: string;
    name: string;
    description: string;
    priority: number;
    singlePremise?: boolean;
    taskType?: TaskType;
    budget?: number;
    multiline?: boolean;
}

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

const parseResponse = (response: string, type: TaskType, budget: number): Task[] => {
    if (!response) return [];
    return response.split('\n').filter(l => l.trim()).map(line => {
        const parsed = LMResponseParser.parse(line);
        const term = parsed.valid && parsed.term ? parsed.term : {kind: 'atom' as const, symbol: line.trim(), hash: 0};
        return createTask(term, type, parsed.truth ?? Truth.NEUTRAL, createBudget(budget));
    });
};

const createTaskGen = (type: TaskType, budget: number) => (_r: unknown, _p: Term) => {
    const response = typeof _r === 'string' ? _r : String(_r);
    const parsed = LMResponseParser.parse(response);
    return parsed.valid && parsed.term
        ? [createTask(parsed.term, type, parsed.truth ?? Truth.NEUTRAL, createBudget(budget))]
        : [createTask({kind: 'atom' as const, symbol: response.trim(), hash: 0}, type, Truth.NEUTRAL, createBudget(budget))];
};

const define = (
    id: string, name: string, desc: string, priority: number,
    taskType: TaskType = 'belief', budget = 0.7, multiline = false
): LMRuleDefinition => ({id, name, description: desc, priority, taskType, budget, multiline});

const ruleDefs: LMRuleDefinition[] = [
    define('lm-narsese-translation', 'LMNarseseTranslationRule', 'Translates natural language to Narsese', 0.9, 'belief', 0.9),
    define('lm-belief-revision', 'LMBeliefRevisionRule', 'Revises belief confidence based on context', 0.8, 'belief', 0.7),
    define('lm-goal-decomposition', 'LMGoalDecompositionRule', 'Decomposes complex goals into subgoals', 0.85, 'goal', 0.8, true),
    define('lm-hypothesis-generation', 'LMHypothesisGenerationRule', 'Generates hypotheses from observations', 0.75, 'belief', 0.6),
    define('lm-explanation-generation', 'LMExplanationGenerationRule', 'Generates explanations for beliefs', 0.7, 'belief', 0.65),
    define('lm-analogical-reasoning', 'LMAnalogicalReasoningRule', 'Performs analogical reasoning between concepts', 0.8, 'belief', 0.7),
    define('lm-meta-reasoning', 'LMMetaReasoningGuidanceRule', 'Provides meta-level reasoning guidance', 0.75, 'belief', 0.65),
    define('lm-uncertainty-calibration', 'LMUncertaintyCalibrationRule', 'Calibrates uncertainty in beliefs', 0.7, 'belief', 0.6),
    define('lm-schema-induction', 'LMSchemaInductionRule', 'Induces schemas from examples', 0.75, 'belief', 0.65),
    define('lm-temporal-causal', 'LMTemporalCausalModelingRule', 'Models temporal and causal relationships', 0.8, 'belief', 0.7),
    define('lm-variable-grounding', 'LMVariableGroundingRule', 'Grounds variables in concrete instances', 0.7, 'belief', 0.65),
    define('lm-concept-elaboration', 'LMConceptElaborationRule', 'Elaborates on concept properties', 0.75, 'belief', 0.7),
    define('lm-interactive-clarification', 'LMInteractiveClarificationRule', 'Seeks clarification for ambiguous inputs', 0.7, 'question', 0.65),
];

const prompts: Record<string, string> = {
    'lm-narsese-translation': 'Translate the following sentence into Narsese logic. Sentence: "{{taskTerm}}"',
    'lm-belief-revision': 'Given "{{primaryTerm}}", should its confidence be revised?',
    'lm-goal-decomposition': 'Decompose the goal "{{primaryTerm}}" into simpler subgoals.',
    'lm-hypothesis-generation': 'Given "{{primaryTerm}}", what are possible explanations?',
    'lm-explanation-generation': 'Explain why "{{primaryTerm}}" might be true.',
    'lm-analogical-reasoning': 'What is analogous to "{{primaryTerm}}"?',
    'lm-meta-reasoning': 'Analyze the reasoning for "{{primaryTerm}}".',
    'lm-uncertainty-calibration': 'For "{{primaryTerm}}", what confidence level is appropriate?',
    'lm-schema-induction': 'From "{{primaryTerm}}", what schema can be induced?',
    'lm-temporal-causal': 'What temporal/causal relationships involve "{{primaryTerm}}"?',
    'lm-variable-grounding': 'What concrete instances ground "{{primaryTerm}}"?',
    'lm-concept-elaboration': 'Elaborate on "{{primaryTerm}}". What are its properties?',
    'lm-interactive-clarification': 'What clarification is needed for "{{primaryTerm}}"?',
};

const createRule = (lm: LMClient | null, def: LMRuleDefinition, config: Partial<LMRuleConfig> = {}): LMRule => {
    const taskType = def.taskType ?? 'belief';
    const budget = def.budget ?? 0.7;
    return new LMRule(def.id, lm, {
        ...config,
        name: def.name,
        description: def.description,
        priority: def.priority,
        singlePremise: def.singlePremise ?? true,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\n${prompts[def.id]}`,
        taskGenerator: def.multiline
            ? (r: unknown) => parseResponse(String(r), taskType, budget)
            : createTaskGen(taskType, budget)
    });
};

const getRuleDef = (index: number): LMRuleDefinition => {
    const def = ruleDefs[index];
    if (!def) throw new Error(`Rule definition at index ${index} not found`);
    return def;
};

export const LMRules = {
    createNarseseTranslationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(0), config),
    createBeliefRevisionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(1), config),
    createGoalDecompositionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(2), config),
    createHypothesisGenerationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(3), config),
    createExplanationGenerationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(4), config),
    createAnalogicalReasoningRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(5), config),
    createMetaReasoningGuidanceRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(6), config),
    createUncertaintyCalibrationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(7), config),
    createSchemaInductionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(8), config),
    createTemporalCausalModelingRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(9), config),
    createVariableGroundingRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(10), config),
    createConceptElaborationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(11), config),
    createInteractiveClarificationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, getRuleDef(12), config),
    createAll: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => ruleDefs.map(d => createRule(lm, d, config)),
    create: (id: string, lm: LMClient | null, config?: Partial<LMRuleConfig>) => {
        const def = ruleDefs.find(d => d.id === id);
        return def ? createRule(lm, def, config) : undefined;
    }
};