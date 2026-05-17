/**
 * Agent API Definitions
 * All agent operations registered with unified API registry
 */

import {z} from 'zod';
import {APIRegistry} from './registry.js';
import {Agent} from '../agent/Agent.js';
import {termParser} from '../nar/terms/index.js';

import type {NAR} from '../nar/nar.js';
import type {ScenarioRunner} from '../agent/scenarios/ScenarioRunner.js';
import type {ExperimentRunner} from '../agent/experiments/ExperimentRunner.js';
import type {SelfAnalyzer} from '../agent/SelfAnalyzer.js';
import type {RegressionTracker} from '../agent/scenarios/RegressionTracker.js';
import {getSuiteById, getSuiteByTag, allSuites} from '../agent/benchmarks/index.js';

const registry = APIRegistry.getInstance();

const TermSchema = z.string().min(1, 'Term cannot be empty');
const TruthSchema = z.object({f: z.number().min(0).max(1), c: z.number().min(0).max(1)}).optional();
const PaginationSchema = z.object({
    page: z.number().positive().optional(),
    limit: z.number().positive().max(100).optional()
});

type TaskType = 'beliefs' | 'goals' | 'questions';

const registerListEndpoint = (nar: NAR, type: TaskType) => {
    registry.register(`get${type.charAt(0).toUpperCase() + type.slice(1)}`, {
        description: `List all ${type} in the knowledge base`,
        params: z.object({pagination: PaginationSchema.optional()}),
        returns: z.object({[type]: z.array(z.object({})), total: z.number()}),
        handler: async () => {
            const items = type === 'beliefs' ? nar.getBeliefs()
                : type === 'goals' ? nar.getGoals()
                    : nar.getQuestions();
            return {[type]: items, total: items.length};
        }
    });
};

export function registerAgentAPI(agent: Agent) {
    const nar = agent.getNAR();

    registry.register('addBelief', {
        description: 'Add a belief to the knowledge base',
        params: z.object({term: TermSchema, truth: TruthSchema}),
        returns: z.object({success: z.boolean(), term: z.string()}),
        handler: async ({term}) => {
            await nar.input(term);
            return {success: true, term};
        }
    });

    registry.register('addGoal', {
        description: 'Add a goal to the knowledge base',
        params: z.object({term: TermSchema, truth: TruthSchema}),
        returns: z.object({success: z.boolean(), term: z.string()}),
        handler: async ({term}) => {
            await nar.input(`${term}!`);
            return {success: true, term};
        }
    });

    registry.register('addQuestion', {
        description: 'Add a question to the knowledge base',
        params: z.object({term: TermSchema}),
        returns: z.object({success: z.boolean(), term: z.string()}),
        handler: async ({term}) => {
            await nar.input(`${term}?`);
            return {success: true, term};
        }
    });

    (['beliefs', 'goals', 'questions'] as TaskType[]).forEach(type => registerListEndpoint(nar, type));

    registry.register('query', {
        description: 'Query the knowledge base',
        params: z.object({term: TermSchema, filter: z.record(z.string(), z.unknown()).optional()}),
        returns: z.object({results: z.array(z.object({})), count: z.number()}),
        handler: async ({term, filter}) => {
            const results = await nar.query.query(termParser.parse(term), filter);
            return {results: results.beliefs, count: results.beliefs.length};
        }
    });

    registry.register('ask', {
        description: 'Ask a question and get an answer',
        params: z.object({question: TermSchema, steps: z.number().positive().max(100).optional()}),
        returns: z.object({answer: z.string(), derivations: z.number()}),
        handler: async ({question, steps = 5}) => {
            await nar.input(question);
            const derived = await nar.run(steps);
            return {answer: derived > 0 ? `Found ${derived} derivations` : 'No answer found', derivations: derived};
        }
    });

    registry.register('getStats', {
        description: 'Get system statistics',
        params: z.object({}),
        returns: z.object({
            totalConcepts: z.number(),
            totalTasks: z.number(),
            rulesFired: z.number(),
            derivations: z.number()
        }),
        handler: async () => {
            const stats = nar.getStatistics();
            const metrics = nar.getMetrics();
            return {
                totalConcepts: stats.totalConcepts, totalTasks: stats.totalTasks,
                rulesFired: metrics.system.totalSteps || 0, derivations: metrics.system.totalDerivations || 0
            };
        }
    });

    registry.register('getHealth', {
        description: 'Health check',
        params: z.object({}),
        returns: z.object({
            status: z.string(), timestamp: z.number(), uptime: z.number(),
            memory: z.object({concepts: z.number(), tasks: z.number()}),
            lm: z.object({available: z.boolean(), provider: z.string().optional(), model: z.string().optional()})
        }),
        handler: async () => {
            const stats = nar.getStatistics();
            const lm = nar.getLMClient?.();
            return {
                status: 'healthy', timestamp: Date.now(), uptime: process.uptime(),
                memory: {concepts: stats.totalConcepts ?? 0, tasks: stats.totalTasks ?? 0},
                lm: lm ? {
                    available: true,
                    provider: lm.provider ?? 'unknown',
                    model: lm.model ?? 'unknown'
                } : {available: false}
            };
        }
    });

    registry.register('run', {
        description: 'Run inference steps',
        params: z.object({steps: z.number().positive().max(100)}),
        returns: z.object({derived: z.number()}),
        handler: async ({steps}) => ({derived: await nar.run(steps)})
    });

    registry.register('getConfig', {
        description: 'Get system configuration',
        params: z.object({key: z.string().optional()}),
        returns: z.record(z.string(), z.unknown()),
        handler: async ({key}) => {
            const config = nar.getConfig();
            return key ? {[key]: config[key as keyof typeof config]} : config;
        }
    });

    registry.register('getAttention', {
        description: 'Get attention snapshot',
        params: z.object({}),
        returns: z.object({concepts: z.array(z.object({term: z.string(), priority: z.number()})), total: z.number()}),
        handler: async () => {
            const attention = nar.attentionReport();
            return {concepts: attention.concepts, total: attention.total};
        }
    });

    registry.register('getHistory', {
        description: 'Get task history',
        params: z.object({limit: z.number().positive().max(1000).optional()}),
        returns: z.object({tasks: z.array(z.object({})), count: z.number()}),
        handler: async ({limit = 100}) => {
            const tasks = nar.tools.getHistory(limit);
            return {tasks, count: tasks.length};
        }
    });

    return registry;
}

export function registerScenarioAPIs(scenarioRunner: ScenarioRunner) {
    registry.register('runScenario', {
        description: 'Run a single scenario',
        params: z.object({id: z.string()}),
        returns: z.object({passed: z.boolean(), score: z.number()}),
        handler: async ({id}) => {
            const scenario = allSuites.flatMap(s => s.scenarios).find(s => s.id === id);
            if (!scenario) throw new Error(`Scenario not found: ${id}`);
            const result = await scenarioRunner.run(scenario);
            return {passed: result.passed, score: result.score};
        }
    });

    registry.register('listScenarios', {
        description: 'List scenarios filtered by tag',
        params: z.object({tag: z.string().optional()}),
        returns: z.object({scenarios: z.array(z.object({id: z.string(), name: z.string()})), total: z.number()}),
        handler: async ({tag}) => {
            const scenarios = tag
                ? allSuites.filter(s => s.tag === tag).flatMap(s => s.scenarios)
                : allSuites.flatMap(s => s.scenarios);
            return {scenarios: scenarios.map(s => ({id: s.id, name: s.name})), total: scenarios.length};
        }
    });

    registry.register('runBenchmark', {
        description: 'Run a benchmark suite',
        params: z.object({suite: z.string()}),
        returns: z.object({passed: z.number(), failed: z.number(), score: z.number()}),
        handler: async ({suite}) => {
            const suiteObj = getSuiteById(suite) ?? getSuiteByTag(suite);
            if (!suiteObj) throw new Error(`Suite not found: ${suite}`);
            const results = await scenarioRunner.runBatch(suiteObj.scenarios);
            const passed = results.filter(r => r.passed).length;
            const score = results.reduce((sum, r) => sum + r.score, 0) / Math.max(1, results.length);
            return {passed, failed: results.length - passed, score};
        }
    });

    return registry;
}

export function registerExperimentAPIs(experimentRunner: ExperimentRunner) {
    registry.register('createExperiment', {
        description: 'Create a new experiment',
        params: z.object({
            type: z.string(),
            name: z.string(),
            description: z.string(),
            config: z.record(z.string(), z.unknown()).optional(),
        }),
        returns: z.object({id: z.string()}),
        handler: async ({type, name, description, config}) => {
            const experiment = experimentRunner.createExperiment({
                type: type as any,
                name,
                description,
                ...(config ?? {}),
            });
            return {id: experiment.id};
        }
    });

    registry.register('runExperiment', {
        description: 'Run an experiment',
        params: z.object({id: z.string()}),
        returns: z.object({score: z.number(), duration: z.number()}),
        handler: async ({id}) => {
            const result = await experimentRunner.runExperiment(id);
            return {score: result?.score ?? 0, duration: result?.duration ?? 0};
        }
    });

    registry.register('listExperiments', {
        description: 'List experiments',
        params: z.object({status: z.string().optional()}),
        returns: z.object({experiments: z.array(z.object({id: z.string(), name: z.string(), status: z.string()}))}),
        handler: async ({status}) => {
            const experiments = experimentRunner.listExperiments(status);
            return {experiments: experiments.map(e => ({id: e.id, name: e.name, status: e.status}))};
        }
    });

    return registry;
}

export function registerSelfAnalysisAPIs(selfAnalyzer: SelfAnalyzer) {
    registry.register('selfAnalyze', {
        description: 'Run self-analysis',
        params: z.object({}),
        returns: z.object({timestamp: z.number(), recommendations: z.array(z.string())}),
        handler: async () => {
            const report = await selfAnalyzer.analyzeEpisodicMemory();
            return {timestamp: report.timestamp, recommendations: report.recommendations};
        }
    });

    registry.register('selfPropose', {
        description: 'Get improvement suggestions',
        params: z.object({}),
        returns: z.object({proposals: z.array(z.object({id: z.string(), description: z.string()}))}),
        handler: async () => {
            const proposals = selfAnalyzer.proposeImprovements();
            return {proposals: proposals.map(p => ({id: p.id, description: p.description}))};
        }
    });

    return registry;
}

export function registerRegressionAPIs(regressionTracker: RegressionTracker) {
    registry.register('getBenchmarkHistory', {
        description: 'Get benchmark history',
        params: z.object({suite: z.string(), limit: z.number().optional()}),
        returns: z.object({history: z.array(z.object({score: z.number(), timestamp: z.number()}))}),
        handler: async ({suite, limit = 10}) => {
            const history = regressionTracker.getHistory(suite, limit);
            return {history: history.map(h => ({score: h.score, timestamp: h.timestamp}))};
        }
    });

    registry.register('detectRegression', {
        description: 'Check for benchmark regression',
        params: z.object({suite: z.string()}),
        returns: z.object({hasRegression: z.boolean(), message: z.string().nullable()}),
        handler: async ({suite}) => {
            const result = regressionTracker.detectRegression(suite);
            return {hasRegression: result?.hasRegression ?? false, message: result?.message ?? null};
        }
    });

    return registry;
}

export {registry};
