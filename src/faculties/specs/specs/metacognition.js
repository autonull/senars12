/**
 * Metacognition Faculty Specs — governance, communication, learning, memory, and reflection.
 */
import { createFallback } from './utils';
/** Governance Faculty - policy and constraint enforcement */
export const governanceSpec = {
    name: 'governance',
    description: 'Enforces policies, constraints, and safety boundaries',
    category: 'governance',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    policies: { type: 'array', items: { type: 'object' } },
                    strictMode: { type: 'boolean' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            allowed: { type: 'boolean' },
            violations: { type: 'array', items: { type: 'string' } },
            requiredApprovals: { type: 'array', items: { type: 'string' } },
        },
    },
    oracleOperation: 'engine.custom',
    fallback: createFallback('governance', { allowed: true, violations: [], requiredApprovals: [] }, 0.9, 'Governance fallback', 0.9),
    enabled: true,
    priority: 1.0,
    budgetCost: 0.05,
    maxConcurrency: 20,
    timeoutMs: 2000,
};
/** Communication Faculty - formats output for users */
export const communicationSpec = {
    name: 'communication',
    description: 'Formats and structures output for human consumption',
    category: 'communication',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    format: { type: 'string' },
                    audience: { type: 'string' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            message: { type: 'string' },
            format: { type: 'string' },
            metadata: { type: 'object' },
        },
    },
    oracleOperation: 'lm.generateText',
    fallback: createFallback('communication', { message: '', format: 'text', metadata: {} }, 0.5, 'Communication fallback', 0.5),
    enabled: true,
    priority: 0.7,
    budgetCost: 0.1,
    maxConcurrency: 10,
    timeoutMs: 5000,
};
/** Narrate Explain Faculty - generates explanations */
export const narrateExplainSpec = {
    name: 'narrate.explain',
    description: 'Generates natural language explanations for decisions',
    category: 'communication',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    audience: { type: 'string' },
                    detailLevel: { type: 'string' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            explanation: { type: 'string' },
            confidence: { type: 'number' },
            keyPoints: { type: 'array', items: { type: 'string' } },
        },
    },
    oracleOperation: 'lm.generateText',
    fallback: createFallback('narrate.explain', { explanation: '', confidence: 0.1, keyPoints: [] }, 0.1, 'Explanation fallback', 0.1),
    enabled: true,
    priority: 0.7,
    budgetCost: 0.2,
    maxConcurrency: 5,
    timeoutMs: 10000,
};
/** Induction Faculty - generalizes from examples */
export const inductionSpec = {
    name: 'induction',
    description: 'Induces general patterns from specific examples',
    category: 'learning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            secondary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    minExamples: { type: 'number' },
                    generalizationLevel: { type: 'number' },
                },
            },
        },
        required: ['primary', 'secondary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            generalizations: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'object' },
                        truth: { type: 'object' },
                        examples: { type: 'number' },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('induction', { generalizations: [] }, 0.15, 'Inductive fallback', 0.15),
    enabled: true,
    priority: 0.6,
    budgetCost: 0.3,
    maxConcurrency: 3,
    timeoutMs: 15000,
};
/** Propose Skill Faculty - suggests new skills to learn */
export const proposeSkillSpec = {
    name: 'propose.skill',
    description: 'Proposes new skills or capabilities to acquire',
    category: 'learning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    currentSkills: { type: 'array', items: { type: 'string' } },
                    gaps: { type: 'array', items: { type: 'string' } },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            skills: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        difficulty: { type: 'number' },
                        prerequisites: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('propose.skill', { skills: [] }, 0.1, 'Skill proposal fallback', 0.1),
    enabled: true,
    priority: 0.5,
    budgetCost: 0.2,
    maxConcurrency: 3,
    timeoutMs: 10000,
};
/** Propose Repair Faculty - suggests fixes for errors */
export const proposeRepairSpec = {
    name: 'propose.repair',
    description: 'Proposes repairs for detected inconsistencies or failures',
    category: 'meta',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    errorType: { type: 'string' },
                    context: { type: 'object' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            repairs: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        action: { type: 'string' },
                        description: { type: 'string' },
                        confidence: { type: 'number' },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('propose.repair', { repairs: [] }, 0.15, 'Repair proposal fallback', 0.15),
    enabled: true,
    priority: 0.75,
    budgetCost: 0.2,
    maxConcurrency: 4,
    timeoutMs: 10000,
};
/** Mirror Postmortem Faculty - retrospective analysis */
export const mirrorPostmortemSpec = {
    name: 'mirror.postmortem',
    description: 'Performs retrospective analysis on past decisions',
    category: 'meta',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    timeWindow: { type: 'number' },
                    focus: { type: 'string' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            insights: {
                type: 'array',
                items: { type: 'object' },
            },
            lessons: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('mirror.postmortem', { insights: [], lessons: [], recommendations: [] }, 0.05, 'Postmortem fallback', 0.05),
    enabled: true,
    priority: 0.3,
    budgetCost: 0.4,
    maxConcurrency: 2,
    timeoutMs: 60000,
};
/** Retrieve Rerank Faculty - retrieves and reranks memories */
export const retrieveRerankSpec = {
    name: 'retrieve.rerank',
    description: 'Retrieves relevant memories and reranks by relevance',
    category: 'memory',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    query: { type: 'object' },
                    maxResults: { type: 'number' },
                    rerankStrategy: { type: 'string' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            results: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        memory: { type: 'object' },
                        score: { type: 'number' },
                        rank: { type: 'number' },
                    },
                },
            },
        },
    },
    oracleOperation: 'retrieval.query',
    fallback: createFallback('retrieve.rerank', { results: [] }, 0.2, 'Retrieval fallback', 0.2),
    enabled: true,
    priority: 0.9,
    budgetCost: 0.1,
    maxConcurrency: 10,
    timeoutMs: 5000,
};
