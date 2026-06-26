import type {EnhancedMCPAdapter} from './mcp';
import type {NAR} from '../nar';
import type {Agent} from '../agent';

export interface MCPResourceContext {
    nar: NAR;
    agent?: Agent;
}

export function registerMCPResources(adapter: EnhancedMCPAdapter, _context: MCPResourceContext): void {
    adapter.registerCapability({
        name: 'nar://beliefs',
        description: 'All stored beliefs with truth values',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'nar://concepts',
        description: 'Active concepts with attention priorities',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'nar://attention',
        description: 'Current attention snapshot',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'nar://state',
        description: 'NAR state summary (beliefs/goals/questions/attention/drives)',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'nar://episodes',
        description: 'Recent episodic memory entries',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'nar://benchmarks',
        description: 'Benchmark history and scores',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'nar://config',
        description: 'Current configuration',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'nar://tools',
        description: 'Available tools with schemas',
        inputSchema: {type: 'object', properties: {}},
    });

    // Session resources
    adapter.registerCapability({
        name: 'sessions://list',
        description: 'List all available sessions',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'sessions://{key}',
        description: 'Get session history by key',
        inputSchema: {
            type: 'object',
            properties: {key: {type: 'string'}},
            required: ['key'],
        },
    });

    // Knowledge resources
    adapter.registerCapability({
        name: 'knowledge://list',
        description: 'List all knowledge entries',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'knowledge://{key}',
        description: 'Get knowledge entry by key',
        inputSchema: {
            type: 'object',
            properties: {key: {type: 'string'}},
            required: ['key'],
        },
    });

    // LM Rules resources
    adapter.registerCapability({
        name: 'lm-rules://stats',
        description: 'LM Rule statistics (calls, successes, failures, circuit state)',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'lm-rules://execution-log',
        description: 'Recent LM Rule execution log',
        inputSchema: {type: 'object', properties: {}},
    });

    // RLFP resources
    adapter.registerCapability({
        name: 'rlfp://state',
        description: 'RLFP learner state (policy, exploration rate, rewards)',
        inputSchema: {type: 'object', properties: {}},
    });

    // Self-reasoning resources
    adapter.registerCapability({
        name: 'self-reasoning://quality',
        description: 'Self-reasoning quality metrics (overall, coherence, relevance, completeness)',
        inputSchema: {type: 'object', properties: {}},
    });
}

export function getResourceContent(
    adapter: EnhancedMCPAdapter,
    context: MCPResourceContext,
    uri: string
): string {
    const {nar, agent} = context;

    // Handle parameterized resources
    if (uri.startsWith('sessions://') && uri !== 'sessions://list') {
        const key = uri.replace('sessions://', '');
        // Sessions would need to be accessed via session manager
        return `Session: ${key}`;
    }

    if (uri.startsWith('knowledge://') && uri !== 'knowledge://list') {
        const key = uri.replace('knowledge://', '');
        if (agent) {
            const value = agent.knowGet?.(key);
            if (value !== undefined) return JSON.stringify({key, value}, null, 2);
        }
        return `Unknown knowledge key: ${key}`;
    }

    switch (uri) {
        case 'nar://beliefs': {
            const beliefs = nar.getBeliefs();
            return JSON.stringify(beliefs.map(b => ({term: b.term.toString(), truth: b.truth})), null, 2);
        }
        case 'nar://concepts':
        case 'nar://attention': {
            const report = nar.attentionReport();
            return JSON.stringify(report, null, 2);
        }
        case 'nar://state': {
            const beliefs = nar.getBeliefs().map(b => ({term: b.term.toString(), truth: b.truth}));
            const goals = nar.getGoals?.().map(g => ({term: g.term.toString(), truth: g.truth})) ?? [];
            const questions = nar.getQuestions?.().map(q => ({term: q.term.toString(), truth: q.truth})) ?? [];
            const attention = nar.attentionReport();
            const drives = nar.getDriveManager?.()?.getAllStates?.() ?? [];
            return JSON.stringify({beliefs, goals, questions, attention, drives}, null, 2);
        }
        case 'nar://episodes':
            return JSON.stringify({episodes: []}, null, 2);
        case 'nar://benchmarks':
            return JSON.stringify({history: []}, null, 2);
        case 'nar://config':
            return JSON.stringify(nar.getConfig(), null, 2);
        case 'nar://tools': {
            const tools = nar.tools.list();
            return JSON.stringify(tools.map(t => ({name: t.name, description: t.description})), null, 2);
        }
        case 'sessions://list': {
            // Sessions would be available via SessionManager
            return JSON.stringify([], null, 2);
        }
        case 'knowledge://list': {
            if (agent) {
                const knowledge = agent.knowList?.() ?? [];
                return JSON.stringify(knowledge, null, 2);
            }
            return JSON.stringify([], null, 2);
        }
        case 'lm-rules://stats': {
            const stats = nar.getProcessor()?.getLmRuleStats?.() ?? [];
            return JSON.stringify(stats, null, 2);
        }
        case 'lm-rules://execution-log': {
            const log = nar.getProcessor()?.getLMRuleExecutionLog?.() ?? [];
            return JSON.stringify(log, null, 2);
        }
        case 'rlfp://state': {
            const rlfp = nar.getRLFP?.();
            if (!rlfp) return JSON.stringify({enabled: false}, null, 2);
            const policyOptimizer = rlfp.policyOptimizerPublic;
            return JSON.stringify({
                enabled: true,
                policy: Object.fromEntries(
                    policyOptimizer?.getAllStrategies?.().map((s: string) => [s, policyOptimizer.getStrategyStats(s)?.priority ?? 1]) ?? []
                ),
                explorationRate: policyOptimizer?.getConfig?.().explorationRate ?? 0.1,
                totalRewards: rlfp.trajectoryCount ?? 0,
                totalSteps: rlfp.trajectoryCount ?? 0,
            }, null, 2);
        }
        case 'self-reasoning://quality': {
            const self = nar.getSelfAnalyzer?.();
            if (!self) return JSON.stringify({available: false}, null, 2);
            return JSON.stringify({
                available: true,
                overall: 0,
                coherence: 0,
                relevance: 0,
                completeness: 0,
            }, null, 2);
        }
        default:
            return `Unknown resource: ${uri}`;
    }
}
