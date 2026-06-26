/**
 * LM Rule Factory - Unified factory for LM-based inference rules
 * Consolidates rules.ts, dynamic-rules.ts, and rule-factory-v2.ts presets into a single factory
 */
import type {Term} from '../terms';
import {calculateSimilarity, Truth} from '../terms';
import type {Task, TaskType} from '../types';
import {createBudget, createTask} from '../types';
import {LMRule} from './LMRule.js';
import type {LMClient, LMRuleConfig} from './types.js';
import {LMResponseParser} from './parser.js';
import type {ZodSchema} from 'zod';
import {
    AnalogySchema,
    BeliefRevisionSchema,
    ConceptElaborationSchema,
    ExplanationSchema,
    GoalDecompositionSchema,
    HypothesisSchema,
    MetaReasoningSchema,
    QuestionGenerationSchema,
    SchemaInductionSchema,
    TemporalCausalSchema,
    TranslationSchema,
    UncertaintySchema,
    VariableGroundingSchema,
} from '../nl';

export interface LMRuleDefinition {
    id: string;
    name: string;
    description: string;
    priority: number;
    singlePremise?: boolean;
    taskType?: TaskType;
    budget?: number;
    multiline?: boolean;
    activationCondition?: (primary: Term, secondary?: Term, context?: Record<string, unknown>) => boolean;
    schema?: ZodSchema;
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
        const term = parsed.valid && parsed.term ? parsed.term : {kind: 'atom' as const, symbol: line.trim()};
        return createTask(term, type, parsed.truth, createBudget(budget));
    });
};

const createTaskGen = (type: TaskType, budget: number) => (_r: unknown, _p: Term) => {
    const response = typeof _r === 'string' ? _r : String(_r);
    const parsed = LMResponseParser.parse(response);
    return parsed.valid && parsed.term
        ? [createTask(parsed.term, type, parsed.truth, createBudget(budget))]
        : [createTask({kind: 'atom' as const, symbol: response.trim()}, type, Truth.NEUTRAL, createBudget(budget))];
};

// Activation condition helpers
export const hasVariable = (term: Term): boolean => {
    const str = term.toString();
    return /\?[0-9a-zA-Z_]/.test(str);
};

export const isUnderconnected = (_primary: Term, _secondary?: Term, ctx?: Record<string, unknown>): boolean => {
    const linkCount = (ctx?.linkCount as number) ?? 0;
    const avgLinks = (ctx?.avgLinksPerConcept as number) ?? 5;
    return linkCount < avgLinks * 0.3;
};

export const hasLowConfidence = (primary: Term, _secondary?: Term, ctx?: Record<string, unknown>): boolean => {
    const truth = ctx?.truth as { f?: number; c?: number } | undefined;
    return truth ? (truth.c ?? 0) < 0.5 : false;
};

export const hasConflictingBeliefs = (_primary: Term, _secondary?: Term, ctx?: Record<string, unknown>): boolean => {
    return (ctx?.conflictCount as number ?? 0) > 0;
};

export const isComplexGoal = (primary: Term): boolean => {
    const str = primary.toString();
    return str.includes('&') || str.includes('|') || (str.match(/-->/g) ?? []).length > 1;
};

export const hasStructuralSimilarityNoOverlap = (primary: Term, secondary?: Term): boolean => {
    if (!secondary) return false;
    const pAtoms = new Set(primary.toString().match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
    const sAtoms = new Set(secondary.toString().match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
    const sim = calculateSimilarity(primary, secondary);
    const overlap = [...pAtoms].filter(a => sAtoms.has(a)).length;
    return sim > 0.6 && overlap === 0;
};

export const hasHighCuriosity = (_primary: Term, _secondary?: Term, ctx?: Record<string, unknown>): boolean => {
    const driveState = ctx?.driveState as Record<string, number> | undefined;
    return (driveState?.curiosity ?? 0) > 0.6;
};

// Preset rule definitions
const ruleDefs: LMRuleDefinition[] = [
    {
        id: 'lm-narsese-translation',
        name: 'LMNarseseTranslationRule',
        description: 'Translates natural language to Narsese',
        priority: 0.9,
        taskType: 'belief',
        budget: 0.9,
        schema: TranslationSchema
    },
    {
        id: 'lm-belief-revision',
        name: 'LMBeliefRevisionRule',
        description: 'Revises belief confidence based on context',
        priority: 0.8,
        taskType: 'belief',
        budget: 0.7,
        activationCondition: hasConflictingBeliefs,
        schema: BeliefRevisionSchema
    },
    {
        id: 'lm-goal-decomposition',
        name: 'LMGoalDecompositionRule',
        description: 'Decomposes complex goals into subgoals',
        priority: 0.85,
        taskType: 'goal',
        budget: 0.8,
        singlePremise: true,
        activationCondition: isComplexGoal,
        schema: GoalDecompositionSchema
    },
    {
        id: 'lm-hypothesis-generation',
        name: 'LMHypothesisGenerationRule',
        description: 'Generates hypotheses from observations',
        priority: 0.75,
        taskType: 'belief',
        budget: 0.6,
        activationCondition: hasLowConfidence,
        schema: HypothesisSchema
    },
    {
        id: 'lm-explanation-generation',
        name: 'LMExplanationGenerationRule',
        description: 'Generates explanations for beliefs',
        priority: 0.7,
        taskType: 'belief',
        budget: 0.65,
        schema: ExplanationSchema
    },
    {
        id: 'lm-analogical-reasoning',
        name: 'LMAnalogicalReasoningRule',
        description: 'Performs analogical reasoning between concepts',
        priority: 0.8,
        taskType: 'belief',
        budget: 0.7,
        activationCondition: hasStructuralSimilarityNoOverlap,
        schema: AnalogySchema
    },
    {
        id: 'lm-meta-reasoning',
        name: 'LMMetaReasoningGuidanceRule',
        description: 'Provides meta-level reasoning guidance',
        priority: 0.75,
        taskType: 'belief',
        budget: 0.65,
        schema: MetaReasoningSchema
    },
    {
        id: 'lm-uncertainty-calibration',
        name: 'LMUncertaintyCalibrationRule',
        description: 'Calibrates uncertainty in beliefs',
        priority: 0.7,
        taskType: 'belief',
        budget: 0.6,
        schema: UncertaintySchema
    },
    {
        id: 'lm-schema-induction',
        name: 'LMSchemaInductionRule',
        description: 'Induces schemas from examples',
        priority: 0.75,
        taskType: 'belief',
        budget: 0.65,
        schema: SchemaInductionSchema
    },
    {
        id: 'lm-temporal-causal',
        name: 'LMTemporalCausalModelingRule',
        description: 'Models temporal and causal relationships',
        priority: 0.8,
        taskType: 'belief',
        budget: 0.7,
        schema: TemporalCausalSchema
    },
    {
        id: 'lm-variable-grounding',
        name: 'LMVariableGroundingRule',
        description: 'Grounds variables in concrete instances',
        priority: 0.7,
        taskType: 'belief',
        budget: 0.65,
        activationCondition: (p) => hasVariable(p),
        schema: VariableGroundingSchema
    },
    {
        id: 'lm-concept-elaboration',
        name: 'LMConceptElaborationRule',
        description: 'Elaborates on concept properties',
        priority: 0.75,
        taskType: 'belief',
        budget: 0.7,
        activationCondition: isUnderconnected,
        schema: ConceptElaborationSchema
    },
    {
        id: 'lm-curiosity-question',
        name: 'LMCuriosityQuestionRule',
        description: 'Generates questions driven by curiosity',
        priority: 0.7,
        taskType: 'question',
        budget: 0.65,
        singlePremise: true,
        activationCondition: hasHighCuriosity,
        schema: QuestionGenerationSchema
    },
    {
        id: 'lm-interactive-clarification',
        name: 'LMInteractiveClarificationRule',
        description: 'Seeks clarification for ambiguous inputs',
        priority: 0.7,
        taskType: 'question',
        budget: 0.65
    },
    // V2 preset rules (merged from rule-factory-v2.ts)
    {
        id: 'lm-v2-hypothesis',
        name: 'LMV2HypothesisRule',
        description: 'Generates typed hypotheses with truth values',
        priority: 0.75,
        taskType: 'belief',
        singlePremise: true,
        schema: HypothesisSchema
    },
    {
        id: 'lm-v2-explanation',
        name: 'LMV2ExplanationRule',
        description: 'Generates typed explanations with key premises',
        priority: 0.7,
        taskType: 'belief',
        singlePremise: true,
        schema: ExplanationSchema
    },
    {
        id: 'lm-v2-analogy',
        name: 'LMV2AnalogyRule',
        description: 'Finds structural analogies between concepts',
        priority: 0.8,
        taskType: 'belief',
        schema: AnalogySchema
    },
    {
        id: 'lm-v2-causal',
        name: 'LMV2CausalRule',
        description: 'Models causal relationships',
        priority: 0.8,
        taskType: 'belief',
        schema: TemporalCausalSchema
    },
    {
        id: 'lm-v2-schema',
        name: 'LMV2SchemaRule',
        description: 'Induces reusable schemas from patterns',
        priority: 0.75,
        taskType: 'belief',
        singlePremise: true,
        schema: SchemaInductionSchema
    },
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
    'lm-curiosity-question': 'Given "{{primaryTerm}}" and curiosity drive, what questions should be asked? Generate Narsese questions. Respond with JSON: {"questions": [{"narsese": "?term", "relevance": 0.8, "rationale": "..."}]}',
    'lm-interactive-clarification': 'What clarification is needed for "{{primaryTerm}}"?',
    'lm-v2-hypothesis': 'You are a NARS hypothesis generator. Given: {{primaryTerm}}. Generate a plausible hypothesis in Narsese with truth values. Respond with JSON: {"narsese": "(...)", "truth": {"f": 0.8, "c": 0.7}, "rationale": "..."}',
    'lm-v2-explanation': 'You are a NARS explanation generator. Explain why: {{primaryTerm}}. Respond with JSON: {"explanation": "...", "confidence": 0.8, "keyPremises": ["..."]}',
    'lm-v2-analogy': 'You are an analogical reasoning system. Source: {{primaryTerm}}. Target: {{secondaryTerm}}. Find structural analogies. Respond with JSON: {"analogies": [{"source": "...", "target": "...", "mapping": "..."}]}',
    'lm-v2-causal': 'You are a causal reasoning system. Analyze causal relationships for: {{primaryTerm}}. Respond with JSON: {"relations": [{"cause": "...", "effect": "...", "type": "direct|enabling|preventing", "confidence": 0.8}]}',
    'lm-v2-schema': 'You are a schema induction system. Pattern: {{primaryTerm}}. Induce a reusable schema. Respond with JSON: {"schema": "...", "instances": ["..."], "confidence": 0.8}',
};

interface LMRuleFactoryConfig extends Partial<LMRuleConfig> {
    id?: string;
    name?: string;
    description?: string;
    priority?: number;
    promptTemplate?: string;
    taskType?: TaskType;
    budget?: number;
    multiline?: boolean;
    singlePremise?: boolean;
    activationCondition?: (primary: Term, secondary?: Term, context?: Record<string, unknown>) => boolean;
}

export class LMRuleFactory {
    private readonly config: LMRuleFactoryConfig;
    private readonly lm: LMClient | null;

    constructor(lm: LMClient | null, config: LMRuleFactoryConfig = {}) {
        this.lm = lm;
        this.config = config;
    }

    static from(lm: LMClient | null): LMRuleFactory {
        return new LMRuleFactory(lm);
    }

    id(id: string): this {
        this.config.id = id;
        return this;
    }

    name(name: string): this {
        this.config.name = name;
        return this;
    }

    description(desc: string): this {
        this.config.description = desc;
        return this;
    }

    priority(p: number): this {
        this.config.priority = p;
        return this;
    }

    prompt(template: string): this {
        this.config.promptTemplate = template;
        return this;
    }

    taskType(type: TaskType): this {
        this.config.taskType = type;
        return this;
    }

    budget(b: number): this {
        this.config.budget = b;
        return this;
    }

    multiline(ml: boolean): this {
        this.config.multiline = ml;
        return this;
    }

    activation(fn: (primary: Term, secondary?: Term, context?: Record<string, unknown>) => boolean): this {
        this.config.activationCondition = fn;
        return this;
    }

    singlePremise(sp: boolean): this {
        this.config.singlePremise = sp;
        return this;
    }

    narseseTranslation(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-narsese-translation')
            .name('LMNarseseTranslationRule')
            .description('Translates natural language to Narsese')
            .priority(0.9)
            .taskType('belief')
            .budget(0.9)
            .build();
    }

    beliefRevision(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-belief-revision')
            .name('LMBeliefRevisionRule')
            .description('Revises belief confidence based on context')
            .priority(0.8)
            .taskType('belief')
            .budget(0.7)
            .activation(hasConflictingBeliefs)
            .build();
    }

    goalDecomposition(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-goal-decomposition')
            .name('LMGoalDecompositionRule')
            .description('Decomposes complex goals into subgoals')
            .priority(0.85)
            .taskType('goal')
            .budget(0.8)
            .singlePremise(true)
            .activation(isComplexGoal)
            .build();
    }

    hypothesisGeneration(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-hypothesis-generation')
            .name('LMHypothesisGenerationRule')
            .description('Generates hypotheses from observations')
            .priority(0.75)
            .taskType('belief')
            .budget(0.6)
            .activation(hasLowConfidence)
            .build();
    }

    explanationGeneration(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-explanation-generation')
            .name('LMExplanationGenerationRule')
            .description('Generates explanations for beliefs')
            .priority(0.7)
            .taskType('belief')
            .budget(0.65)
            .build();
    }

    analogicalReasoning(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-analogical-reasoning')
            .name('LMAnalogicalReasoningRule')
            .description('Performs analogical reasoning between concepts')
            .priority(0.8)
            .taskType('belief')
            .budget(0.7)
            .activation(hasStructuralSimilarityNoOverlap)
            .build();
    }

    metaReasoning(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-meta-reasoning')
            .name('LMMetaReasoningGuidanceRule')
            .description('Provides meta-level reasoning guidance')
            .priority(0.75)
            .taskType('belief')
            .budget(0.65)
            .build();
    }

    uncertaintyCalibration(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-uncertainty-calibration')
            .name('LMUncertaintyCalibrationRule')
            .description('Calibrates uncertainty in beliefs')
            .priority(0.7)
            .taskType('belief')
            .budget(0.6)
            .build();
    }

    schemaInduction(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-schema-induction')
            .name('LMSchemaInductionRule')
            .description('Induces schemas from examples')
            .priority(0.75)
            .taskType('belief')
            .budget(0.65)
            .build();
    }

    temporalCausal(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-temporal-causal')
            .name('LMTemporalCausalModelingRule')
            .description('Models temporal and causal relationships')
            .priority(0.8)
            .taskType('belief')
            .budget(0.7)
            .build();
    }

    variableGrounding(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-variable-grounding')
            .name('LMVariableGroundingRule')
            .description('Grounds variables in concrete instances')
            .priority(0.7)
            .taskType('belief')
            .budget(0.65)
            .activation(hasVariable)
            .build();
    }

    conceptElaboration(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-concept-elaboration')
            .name('LMConceptElaborationRule')
            .description('Elaborates on concept properties')
            .priority(0.75)
            .taskType('belief')
            .budget(0.7)
            .activation(isUnderconnected)
            .build();
    }

    interactiveClarification(): LMRule {
        return LMRuleFactory.from(this.lm)
            .id('lm-interactive-clarification')
            .name('LMInteractiveClarificationRule')
            .description('Seeks clarification for ambiguous inputs')
            .priority(0.7)
            .taskType('question')
            .budget(0.65)
            .build();
    }

    curiosityQuestion(): LMRule {
        return createRule(this.lm, ruleDefs.find(d => d.id === 'lm-curiosity-question')!);
    }

    v2Hypothesis(): LMRule {
        return createRule(this.lm, ruleDefs.find(d => d.id === 'lm-v2-hypothesis')!);
    }

    v2Explanation(): LMRule {
        return createRule(this.lm, ruleDefs.find(d => d.id === 'lm-v2-explanation')!);
    }

    v2Analogy(): LMRule {
        return createRule(this.lm, ruleDefs.find(d => d.id === 'lm-v2-analogy')!);
    }

    v2Causal(): LMRule {
        return createRule(this.lm, ruleDefs.find(d => d.id === 'lm-v2-causal')!);
    }

    v2Schema(): LMRule {
        return createRule(this.lm, ruleDefs.find(d => d.id === 'lm-v2-schema')!);
    }

    createAll(): LMRule[] {
        return [
            this.narseseTranslation(),
            this.beliefRevision(),
            this.goalDecomposition(),
            this.hypothesisGeneration(),
            this.explanationGeneration(),
            this.analogicalReasoning(),
            this.metaReasoning(),
            this.uncertaintyCalibration(),
            this.schemaInduction(),
            this.temporalCausal(),
            this.variableGrounding(),
            this.conceptElaboration(),
            this.curiosityQuestion(),
            this.interactiveClarification(),
            this.v2Hypothesis(),
            this.v2Explanation(),
            this.v2Analogy(),
            this.v2Causal(),
            this.v2Schema(),
        ];
    }

    build(): LMRule {
        const id = this.config.id;
        if (!id) throw new Error('LMRuleFactory: id is required when building custom rules');
        const def = ruleDefs.find(d => d.id === id);
        if (def) {
            return createRule(this.lm, def, this.config);
        }
        const taskType = this.config.taskType ?? 'belief';
        const budget = this.config.budget ?? 0.7;
        return new LMRule(id, this.lm, {
            name: this.config.name ?? id,
            description: this.config.description ?? 'Custom LM rule',
            priority: this.config.priority ?? 0.8,
            singlePremise: this.config.singlePremise ?? true,
            activationCondition: this.config.activationCondition,
            promptTemplate: this.config.promptTemplate ?? `Reason about: {{primaryTerm}}`,
            taskGenerator: this.config.multiline
                ? (r: unknown) => parseResponse(String(r), taskType, budget)
                : createTaskGen(taskType, budget)
        });
    }
}

const createRule = (lm: LMClient | null, def: LMRuleDefinition, config: Partial<LMRuleConfig> = {}): LMRule => {
    const taskType = def.taskType ?? 'belief';
    const budget = def.budget ?? 0.7;
    return new LMRule(def.id, lm, {
        ...config,
        name: def.name,
        description: def.description,
        priority: def.priority,
        singlePremise: def.singlePremise ?? true,
        activationCondition: def.activationCondition,
        promptTemplate: `${NARSESE_INSTRUCTIONS}\n\n${prompts[def.id]}`,
        taskType,
        outputSchema: def.schema,
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

// Backward compatibility - LMRules object
export const LMRules = Object.freeze({
    create: (index: number, lm: LMClient | null, config?: Partial<LMRuleConfig>): LMRule =>
        createRule(lm, getRuleDef(index), config),
    createById: (id: string, lm: LMClient | null, config?: Partial<LMRuleConfig>): LMRule | undefined => {
        const def = ruleDefs.find(d => d.id === id);
        return def ? createRule(lm, def, config) : undefined;
    },
    createAll: (lm: LMClient | null, config?: Partial<LMRuleConfig>): LMRule[] =>
        ruleDefs.map(d => createRule(lm, d, config)),
    getRuleDef,
    ruleDefs
});

// Dynamic Rule Generator (consolidated from dynamic-rules.ts)
export interface DynamicRuleConfig extends Partial<LMRuleConfig> {
    name: string;
    description: string;
    naturalLanguageDescription: string;
    promptTemplate?: string;
    validationRules?: ValidationRule[];
}

export interface ValidationRule {
    type: 'narsese' | 'json' | 'custom';
    pattern?: string;
    validator?: (response: string) => boolean;
    message: string;
}

export class DynamicLMRuleGenerator {
    private readonly lm: LMClient;
    private readonly baseConfig: Partial<LMRuleConfig>;

    constructor(lm: LMClient, baseConfig?: Partial<LMRuleConfig>) {
        this.lm = lm;
        this.baseConfig = baseConfig ?? {};
    }

    async generateRuleFromDescription(description: string): Promise<LMRule | null> {
        const prompt = `
You are a NARS reasoning system configuration generator.
Given a natural language description of a reasoning rule, generate a rule configuration.

Description: ${description}

Generate a rule in this format:
{
  "id": "rule-id",
  "name": "Rule Name",
  "description": "Description",
  "priority": 0.8,
  "promptTemplate": "Template with {{primaryTerm}} placeholder"
}

Respond with JSON only:
`.trim();

        try {
            const response = await this.lm.generateText(prompt);
            const config = this.parseRuleConfig(response, description);
            return config ? new LMRule(config.id!, this.lm, config) : null;
        } catch {
            return null;
        }
    }

    createRuleFromTemplate(
        id: string,
        name: string,
        description: string,
        promptTemplate: string,
        priority: number = 0.8
    ): LMRule {
        return new LMRule(id, this.lm, {
            ...this.baseConfig,
            id,
            name,
            description,
            priority,
            promptTemplate,
            singlePremise: true
        });
    }

    validateResponse(response: string, rules: ValidationRule[]): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const rule of rules) {
            switch (rule.type) {
                case 'narsese':
                    if (!this.validateNarsese(response, rule.message, errors)) {
                        errors.push(rule.message);
                    }
                    break;
                case 'json':
                    if (!this.validateJSON(response, rule.message, errors)) {
                        errors.push(rule.message);
                    }
                    break;
                case 'custom':
                    if (rule.validator && !rule.validator(response)) {
                        errors.push(rule.message);
                    }
                    break;
            }
        }

        return {valid: errors.length === 0, errors};
    }

    private validateNarsese(response: string, message: string, errors: string[]): boolean {
        try {
            const parsed = LMResponseParser.parse(response);
            if (!parsed.valid) {
                errors.push(message || 'Invalid Narsese format');
                return false;
            }
            return true;
        } catch {
            errors.push(message || 'Failed to parse Narsese');
            return false;
        }
    }

    private validateJSON(response: string, message: string, errors: string[]): boolean {
        try {
            JSON.parse(response);
            return true;
        } catch {
            errors.push(message || 'Invalid JSON format');
            return false;
        }
    }

    private parseRuleConfig(response: string, description: string): LMRuleConfig | null {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;

            const obj = JSON.parse(jsonMatch[0]);
            return {
                id: obj.id || `dynamic-rule-${Date.now()}`,
                name: obj.name || 'Dynamic Rule',
                description: obj.description || description,
                priority: obj.priority ?? 0.8,
                promptTemplate: obj.promptTemplate || `Reason about: {{primaryTerm}}`,
                singlePremise: true
            };
        } catch {
            return {
                id: `dynamic-rule-${Date.now()}`,
                name: 'Dynamic Rule',
                description,
                priority: 0.8,
                promptTemplate: `Reason about: {{primaryTerm}}`,
                singlePremise: true
            };
        }
    }
}

export class CompositeLMRule extends LMRule {
    private readonly componentRules: LMRule[] = [];

    constructor(id: string, lm: LMClient, config: LMRuleConfig) {
        super(id, lm, config);
    }

    addRule(rule: LMRule): void {
        this.componentRules.push(rule);
    }

    override async apply(primary: Term, secondary?: Term, context?: Record<string, unknown>): Promise<Task[]> {
        const allTasks: Task[] = [];

        for (const rule of this.componentRules) {
            try {
                const tasks = await rule.apply(primary, secondary, context);
                allTasks.push(...tasks);
            } catch {
                // expected: individual rule failure shouldn't abort other rules
            }
        }

        return allTasks;
    }

    override canApply(primary: Term, secondary?: Term, context?: Record<string, unknown>): boolean {
        return this.componentRules.some(rule => rule.canApply(primary, secondary, context));
    }
}

export const createDynamicRuleGenerator = (lm: LMClient, baseConfig?: Partial<LMRuleConfig>): DynamicLMRuleGenerator => {
    return new DynamicLMRuleGenerator(lm, baseConfig);
};

export const createCompositeRule = (id: string, lm: LMClient, config: LMRuleConfig): CompositeLMRule => {
    return new CompositeLMRule(id, lm, config);
};