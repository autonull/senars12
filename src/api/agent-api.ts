/**
 * Agent API Definitions
 * All agent operations registered with unified API registry
 */

import {z} from 'zod';
import {APIRegistry} from './registry.js';
import {Agent} from '../agent/Agent.js';
import {termParser} from '../nar/terms/parser.js';

const registry = APIRegistry.getInstance();

// Zod schemas for validation
const TermSchema = z.string().min(1, 'Term cannot be empty');
const TruthSchema = z.object({
    f: z.number().min(0).max(1),
    c: z.number().min(0).max(1),
}).optional();

const PaginationSchema = z.object({
    page: z.number().positive().optional(),
    limit: z.number().positive().max(100).optional(),
});

// API Implementations
export function registerAgentAPI(agent: Agent) {
    const nar = agent.getNAR();

    registry.register('addBelief', {
        description: 'Add a belief to the knowledge base',
        params: z.object({
            term: TermSchema,
            truth: TruthSchema,
        }),
        returns: z.object({
            success: z.boolean(),
            term: z.string(),
        }),
        handler: async ({term, truth: _truth}) => {
            await nar.input(term);
            return {success: true, term};
        },
    });

    registry.register('addGoal', {
        description: 'Add a goal to the knowledge base',
        params: z.object({
            term: TermSchema,
            truth: TruthSchema,
        }),
        returns: z.object({
            success: z.boolean(),
            term: z.string(),
        }),
        handler: async ({term}) => {
            await nar.input(`${term}!`);
            return {success: true, term};
        },
    });

    registry.register('addQuestion', {
        description: 'Add a question to the knowledge base',
        params: z.object({
            term: TermSchema,
        }),
        returns: z.object({
            success: z.boolean(),
            term: z.string(),
        }),
        handler: async ({term}) => {
            await nar.input(`${term}?`);
            return {success: true, term};
        },
    });

    registry.register('getBeliefs', {
        description: 'List all beliefs in the knowledge base',
        params: z.object({
            pagination: PaginationSchema.optional(),
        }),
        returns: z.object({
            beliefs: z.array(z.any()),
            total: z.number(),
        }),
        handler: async () => {
            const beliefs = nar.getBeliefs();
            return {beliefs, total: beliefs.length};
        },
    });

    registry.register('getGoals', {
        description: 'List all goals in the knowledge base',
        params: z.object({
            pagination: PaginationSchema.optional(),
        }),
        returns: z.object({
            goals: z.array(z.any()),
            total: z.number(),
        }),
        handler: async () => {
            const goals = nar.getGoals();
            return {goals, total: goals.length};
        },
    });

    registry.register('getQuestions', {
        description: 'List all questions in the knowledge base',
        params: z.object({
            pagination: PaginationSchema.optional(),
        }),
        returns: z.object({
            questions: z.array(z.any()),
            total: z.number(),
        }),
        handler: async () => {
            const questions = nar.getQuestions();
            return {questions, total: questions.length};
        },
    });

    registry.register('query', {
        description: 'Query the knowledge base',
        params: z.object({
            term: TermSchema,
            filter: z.any().optional(),
        }),
        returns: z.object({
            results: z.array(z.any()),
            count: z.number(),
        }),
        handler: async ({term, filter}) => {
            const termObj = termParser.parse(term);
            const results = await nar.query.query(termObj, filter);
            return {results: results.beliefs, count: results.beliefs.length};
        },
    });

    registry.register('ask', {
        description: 'Ask a question and get an answer',
        params: z.object({
            question: TermSchema,
            steps: z.number().positive().max(100).optional(),
        }),
        returns: z.object({
            answer: z.string(),
            derivations: z.number(),
        }),
        handler: async ({question, steps = 5}) => {
            await nar.input(question);
            const derived = await nar.run(steps);
            return {
                answer: derived > 0 ? `Found ${derived} derivations` : 'No answer found',
                derivations: derived,
            };
        },
    });

    registry.register('getStats', {
        description: 'Get system statistics',
        params: z.object({}),
        returns: z.object({
            totalConcepts: z.number(),
            totalTasks: z.number(),
            rulesFired: z.number(),
            derivations: z.number(),
        }),
        handler: async () => {
            const stats = nar.getStatistics();
            const metrics = nar.getMetrics();
            return {
                totalConcepts: stats.totalConcepts,
                totalTasks: stats.totalTasks,
                rulesFired: metrics.system.totalSteps || 0,
                derivations: metrics.system.totalDerivations || 0,
            };
        },
    });

    registry.register('getHealth', {
        description: 'Health check',
        params: z.object({}),
        returns: z.object({
            status: z.string(),
            timestamp: z.number(),
            uptime: z.number(),
            memory: z.object({
                concepts: z.number(),
                tasks: z.number(),
            }),
            lm: z.object({
                available: z.boolean(),
                provider: z.string().optional(),
                model: z.string().optional(),
            }),
        }),
        handler: async () => {
            const stats = nar.getStatistics();
            const lm = nar.getLMClient?.();
            return {
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime(),
                memory: {
                    concepts: stats.totalConcepts ?? 0,
                    tasks: stats.totalTasks ?? 0,
                },
                lm: lm
                    ? {
                        available: true,
                        provider: (lm as any).provider ?? 'unknown',
                        model: (lm as any).model ?? 'unknown',
                    }
                    : {available: false},
            };
        },
    });

    registry.register('run', {
        description: 'Run inference steps',
        params: z.object({
            steps: z.number().positive().max(100),
        }),
        returns: z.object({
            derived: z.number(),
        }),
        handler: async ({steps}) => {
            const derived = await nar.run(steps);
            return {derived};
        },
    });

    registry.register('getConfig', {
        description: 'Get system configuration',
        params: z.object({
            key: z.string().optional(),
        }),
        returns: z.any(),
        handler: async ({key}) => {
            const config = nar.getConfig();
            return key ? {[key]: (config as any)[key]} : config;
        },
    });

    registry.register('getAttention', {
        description: 'Get attention snapshot',
        params: z.object({}),
        returns: z.object({
            concepts: z.array(z.object({
                term: z.string(),
                priority: z.number(),
            })),
            total: z.number(),
        }),
        handler: async () => {
            const attention = nar.getAttentionReport();
            return {
                concepts: attention.concepts,
                total: attention.total,
            };
        },
    });

    registry.register('getHistory', {
        description: 'Get task history',
        params: z.object({
            limit: z.number().positive().max(1000).optional(),
        }),
        returns: z.object({
            tasks: z.array(z.any()),
            count: z.number(),
        }),
        handler: async ({limit = 100}) => {
            const tasks = nar.tools.getHistory(limit);
            return {tasks, count: tasks.length};
        },
    });

    return registry;
}

export {registry};
