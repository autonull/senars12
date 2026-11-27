/**
 * Judgment Faculty Specs — inference, evaluation, and reasoning.
 */
import { createFallback } from './utils';
/** Inference Faculty - NAL deduction/induction/abduction */
export const inferenceSpec = {
    name: 'inference',
    description: 'Performs NAL inference (deduction, induction, abduction)',
    category: 'reasoning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            secondary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    inferenceType: { type: 'string', enum: ['deduction', 'induction', 'abduction', 'revision'] },
                    maxSteps: { type: 'number' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            conclusions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        term: { type: 'object' },
                        truth: { type: 'object' },
                        inferenceType: { type: 'string' },
                    },
                },
            },
        },
    },
    oracleOperation: 'engine.tau-prolog',
    fallback: createFallback('inference', { conclusions: [] }, 0.2, 'Symbolic inference fallback', 0.2),
    enabled: true,
    priority: 0.95,
    budgetCost: 0.2,
    maxConcurrency: 5,
    timeoutMs: 10000,
};
/** Abduction Faculty - generates hypotheses */
export const abductionSpec = {
    name: 'abduction',
    description: 'Generates explanatory hypotheses for observations',
    category: 'reasoning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    maxHypotheses: { type: 'number' },
                    minConfidence: { type: 'number' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            hypotheses: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        term: { type: 'object' },
                        truth: { type: 'object' },
                        explanation: { type: 'string' },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('abduction', { hypotheses: [] }, 0.15, 'Abductive fallback', 0.15),
    enabled: true,
    priority: 0.7,
    budgetCost: 0.3,
    maxConcurrency: 3,
    timeoutMs: 15000,
};
/** Analogy Faculty - maps between domains */
export const analogySpec = {
    name: 'analogy',
    description: 'Finds structural analogies between domains',
    category: 'reasoning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            secondary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    maxMappings: { type: 'number' },
                    minSimilarity: { type: 'number' },
                },
            },
        },
        required: ['primary', 'secondary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            mappings: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        source: { type: 'object' },
                        target: { type: 'object' },
                        confidence: { type: 'number' },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('analogy', { mappings: [] }, 0.1, 'Analogical fallback', 0.1),
    enabled: true,
    priority: 0.5,
    budgetCost: 0.4,
    maxConcurrency: 2,
    timeoutMs: 20000,
};
/** Revision Faculty - merges conflicting beliefs */
export const revisionSpec = {
    name: 'revision',
    description: 'Revises and merges conflicting beliefs into consistent knowledge',
    category: 'reasoning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            secondary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    revisionType: { type: 'string', enum: ['merge', 'replace', 'weighted'] },
                    confidenceThreshold: { type: 'number' },
                },
            },
        },
        required: ['primary', 'secondary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            revised: { type: 'object' },
            truth: { type: 'object' },
            method: { type: 'string' },
        },
    },
    oracleOperation: 'engine.custom',
    fallback: createFallback('revision', { revised: null, truth: null, method: 'fallback' }, 0.2, 'Revision fallback', 0.2),
    enabled: true,
    priority: 0.8,
    budgetCost: 0.15,
    maxConcurrency: 5,
    timeoutMs: 8000,
};
/** Evaluation Faculty - assesses candidate quality */
export const evaluationSpec = {
    name: 'evaluation',
    description: 'Evaluates candidate solutions against criteria',
    category: 'evaluation',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            secondary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    criteria: { type: 'array', items: { type: 'object' } },
                    threshold: { type: 'number' },
                },
            },
        },
        required: ['primary', 'secondary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            score: { type: 'number' },
            passed: { type: 'boolean' },
            details: { type: 'object' },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('evaluation', { score: 0, passed: false, details: {} }, 0.3, 'Evaluation fallback', 0.3),
    enabled: true,
    priority: 0.8,
    budgetCost: 0.2,
    maxConcurrency: 5,
    timeoutMs: 10000,
};
/** Judge Rubric Faculty - structured evaluation with rubrics */
export const judgeRubricSpec = {
    name: 'judge.rubric',
    description: 'Evaluates outputs against structured rubrics',
    category: 'evaluation',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    rubric: { type: 'object' },
                    strictness: { type: 'number' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            scores: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        criterion: { type: 'string' },
                        score: { type: 'number' },
                        weight: { type: 'number' },
                        reasoning: { type: 'string' },
                    },
                },
            },
            overall: { type: 'number' },
            passed: { type: 'boolean' },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('judge.rubric', { scores: [], overall: 0, passed: false }, 0.2, 'Rubric fallback', 0.2),
    enabled: true,
    priority: 0.75,
    budgetCost: 0.25,
    maxConcurrency: 4,
    timeoutMs: 15000,
};
/** Propose Hypothesis Faculty - generates testable hypotheses */
export const proposeHypothesisSpec = {
    name: 'propose.hypothesis',
    description: 'Proposes testable hypotheses for investigation',
    category: 'reasoning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    domain: { type: 'string' },
                    maxHypotheses: { type: 'number' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            hypotheses: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        term: { type: 'object' },
                        truth: { type: 'object' },
                        testable: { type: 'boolean' },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('propose.hypothesis', { hypotheses: [] }, 0.2, 'Hypothesis fallback', 0.2),
    enabled: true,
    priority: 0.65,
    budgetCost: 0.3,
    maxConcurrency: 3,
    timeoutMs: 15000,
};
