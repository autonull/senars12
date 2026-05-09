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
    promptTemplate: string;
    priority: number;
    taskGenerator: (response: string, primary: Term) => Task[];
    singlePremise?: boolean;
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

const createRule = (lm: LMClient | null, def: LMRuleDefinition | undefined, config: Partial<LMRuleConfig> = {}): LMRule => {
    if (!def) {
        throw new Error('LMRuleDefinition is required');
    }
    return new LMRule(def.id, lm, {
        ...config,
        name: def.name,
        description: def.description,
        singlePremise: def.singlePremise ?? true,
        priority: def.priority,
        promptTemplate: def.promptTemplate,
        taskGenerator: def.taskGenerator
    });
};

const createTaskGenerator = (type: TaskType = 'belief', budget = 0.6) => {
    return (response: string, _primary: Term) => {
        if (!response) return [];

        const parsed = LMResponseParser.parse(response);
        if (parsed.valid && parsed.term) {
            return [createTask(parsed.term, type, parsed.truth ?? Truth.NEUTRAL, createBudget(budget))];
        }

        return [createTask({
            kind: 'atom' as const,
            symbol: response.trim(),
            hash: 0
        }, type, Truth.NEUTRAL, createBudget(budget))];
    };
};

const ruleDefs: LMRuleDefinition[] = [
    {
        id: 'lm-narsese-translation',
        name: 'LMNarseseTranslationRule',
        description: 'Translates natural language to Narsese',
        priority: 0.9,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nTranslate the following sentence into Narsese logic (NARS format). Sentence: "{{taskTerm}}"`,
        taskGenerator: createTaskGenerator('belief', 0.9)
    },
    {
        id: 'lm-belief-revision',
        name: 'LMBeliefRevisionRule',
        description: 'Revises belief confidence based on context',
        priority: 0.8,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nGiven the belief "{{primaryTerm}}", should its confidence be revised? Consider context and evidence. Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.7)
    },
    {
        id: 'lm-goal-decomposition',
        name: 'LMGoalDecompositionRule',
        description: 'Decomposes complex goals into subgoals',
        priority: 0.85,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nDecompose the goal "{{primaryTerm}}" into simpler subgoals. List them step by step in Narsese format.`,
        taskGenerator: (response) => {
            if (!response) return [];
            return response.split('\n').filter(l => l.trim()).map(line => {
                const parsed = LMResponseParser.parse(line);
                return parsed.valid && parsed.term
                    ? createTask(parsed.term, 'goal', parsed.truth ?? Truth.NEUTRAL, createBudget(0.8))
                    : createTask({
                        kind: 'atom' as const,
                        symbol: line.trim(),
                        hash: 0
                    }, 'goal', Truth.NEUTRAL, createBudget(0.8));
            });
        }
    },
    {
        id: 'lm-hypothesis-generation',
        name: 'LMHypothesisGenerationRule',
        description: 'Generates hypotheses from observations',
        priority: 0.75,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nGiven the observation "{{primaryTerm}}", what are possible explanations or hypotheses? Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.6)
    },
    {
        id: 'lm-explanation-generation',
        name: 'LMExplanationGenerationRule',
        description: 'Generates explanations for beliefs',
        priority: 0.7,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nExplain why "{{primaryTerm}}" might be true. Provide reasoning in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.65)
    },
    {
        id: 'lm-analogical-reasoning',
        name: 'LMAnalogicalReasoningRule',
        description: 'Performs analogical reasoning between concepts',
        priority: 0.8,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nWhat is analogous to "{{primaryTerm}}"? Find similar patterns or structures. Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.7)
    },
    {
        id: 'lm-meta-reasoning',
        name: 'LMMetaReasoningGuidanceRule',
        description: 'Provides meta-level reasoning guidance',
        priority: 0.75,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nAnalyze the reasoning process for "{{primaryTerm}}". What meta-level guidance can improve reasoning? Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.65)
    },
    {
        id: 'lm-uncertainty-calibration',
        name: 'LMUncertaintyCalibrationRule',
        description: 'Calibrates uncertainty in beliefs',
        priority: 0.7,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nFor the belief "{{primaryTerm}}", what is the appropriate confidence level? Consider evidence quality. Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.6)
    },
    {
        id: 'lm-schema-induction',
        name: 'LMSchemaInductionRule',
        description: 'Induces schemas from examples',
        priority: 0.75,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nFrom the example "{{primaryTerm}}", what general schema or pattern can be induced? Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.65)
    },
    {
        id: 'lm-temporal-causal',
        name: 'LMTemporalCausalModelingRule',
        description: 'Models temporal and causal relationships',
        priority: 0.8,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nWhat are the temporal or causal relationships involving "{{primaryTerm}}"? Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.7)
    },
    {
        id: 'lm-variable-grounding',
        name: 'LMVariableGroundingRule',
        description: 'Grounds variables in concrete instances',
        priority: 0.7,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nWhat concrete instances ground the variable concepts in "{{primaryTerm}}"? Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.65)
    },
    {
        id: 'lm-concept-elaboration',
        name: 'LMConceptElaborationRule',
        description: 'Elaborates on concept properties',
        priority: 0.75,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nElaborate on the concept "{{primaryTerm}}". What are its key properties and relationships? Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('belief', 0.7)
    },
    {
        id: 'lm-interactive-clarification',
        name: 'LMInteractiveClarificationRule',
        description: 'Seeks clarification for ambiguous inputs',
        priority: 0.7,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\nWhat clarification is needed for "{{primaryTerm}}"? Generate questions to resolve ambiguity. Respond in Narsese format.`,
        taskGenerator: createTaskGenerator('question', 0.65)
    }
];

export const createLMRule = (id: string, lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule | undefined => {
    const def = ruleDefs.find(d => d.id === id);
    return def ? createRule(lm, def, config) : undefined;
};

export const createAllLMRules = (lm: LMClient | null, config: Partial<LMRuleConfig> = {}): LMRule[] =>
    ruleDefs.map(def => createRule(lm, def, config));

export const LMRules = {
    createNarseseTranslationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[0], config),
    createBeliefRevisionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[1], config),
    createGoalDecompositionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[2], config),
    createHypothesisGenerationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[3], config),
    createExplanationGenerationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[4], config),
    createAnalogicalReasoningRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[5], config),
    createMetaReasoningGuidanceRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[6], config),
    createUncertaintyCalibrationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[7], config),
    createSchemaInductionRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[8], config),
    createTemporalCausalModelingRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[9], config),
    createVariableGroundingRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[10], config),
    createConceptElaborationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[11], config),
    createInteractiveClarificationRule: (lm: LMClient | null, config?: Partial<LMRuleConfig>) => createRule(lm, ruleDefs[12], config),
    createAll: createAllLMRules
};
