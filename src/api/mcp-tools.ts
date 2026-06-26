import type {NAR} from '../nar';
import type {Agent} from '../agent';
import type {EnhancedMCPAdapter} from './mcp';
import {z} from 'zod';
import {promises as fs} from 'node:fs';

export function registerNARToolsAsMCP(nar: NAR, adapter: EnhancedMCPAdapter): void {
    const registry = adapter['registry'];

    // Calculate tool
    registry.register('calculate', {
        description: 'Evaluate arithmetic/math expressions',
        params: z.object({expression: z.string()}),
        returns: z.any(),
        handler: async ({expression}: { expression: string }) => {
            // Safe eval for math expressions
            const result = eval(expression.replace(/[^0-9+\-*/.()eE\s]/g, ''));
            return {result};
        },
    });

    // Read file tool
    registry.register('read_file', {
        description: 'Read file contents',
        params: z.object({path: z.string()}),
        returns: z.any(),
        handler: async ({path}: { path: string }) => {
            const content = await fs.readFile(path, 'utf-8');
            return {path, content};
        },
    });

    // Write file tool
    registry.register('write_file', {
        description: 'Write content to file',
        params: z.object({path: z.string(), content: z.string()}),
        returns: z.any(),
        handler: async ({path, content}: { path: string; content: string }) => {
            await fs.writeFile(path, content, 'utf-8');
            return {success: true};
        },
    });

    // Search memory tool
    registry.register('search_memory', {
        description: 'Search NAR memory for beliefs',
        params: z.object({query: z.string()}),
        returns: z.any(),
        handler: async ({query}: { query: string }) => {
            const beliefs = nar.getBeliefs();
            return beliefs.filter(b => b.term.toString().toLowerCase().includes(query.toLowerCase()));
        },
    });

    // Run reasoning tool
    registry.register('run_reasoning', {
        description: 'Run NAL inference steps',
        params: z.object({steps: z.number()}),
        returns: z.any(),
        handler: async ({steps}: { steps: number }) => {
            const derived = await nar.run(steps);
            return {derived, beliefs: nar.getBeliefs().slice(-10)};
        },
    });

    // Learn belief tool
    registry.register('learn_belief', {
        description: 'Add a belief to memory',
        params: z.object({belief: z.string()}),
        returns: z.any(),
        handler: async ({belief}: { belief: string }) => {
            await nar.believe(belief);
            return {added: belief};
        },
    });

    // Explain belief tool
    registry.register('explain_belief', {
        description: 'Explain how a belief was derived',
        params: z.object({term: z.string()}),
        returns: z.any(),
        handler: async ({term}: { term: string }) => {
            return {term, derivation: 'N/A'};
        },
    });
}

export function registerAgentAPI(agent: Agent, adapter: EnhancedMCPAdapter): void {
    const registry = adapter['registry'];

    registry.register('agent_chat', {
        description: 'Chat with the agent (non-streaming)',
        params: z.object({input: z.string(), historyLimit: z.number().optional()}),
        returns: z.any(),
        handler: async ({input}: { input: string; historyLimit?: number }) => {
            return agent.chat(input);
        },
    });

    registry.register('agent_chat_stream', {
        description: 'Chat with the agent (streaming)',
        params: z.object({input: z.string(), historyLimit: z.number().optional()}),
        returns: z.any(),
        handler: async ({input}: { input: string; historyLimit?: number }) => {
            let result = '';
            for await (const event of agent.chatStream(input)) {
                if (event.kind === 'finish' || event.kind === 'aborted' || event.kind === 'error') {
                    result = event.text ?? '';
                }
            }
            return result;
        },
    });

    registry.register('agent_believe', {
        description: 'Add a belief to NAR memory',
        params: z.object({narsese: z.string()}),
        returns: z.any(),
        handler: async ({narsese}: { narsese: string }) => {
            await agent.believe(narsese);
            return {success: true};
        },
    });

    registry.register('agent_recall', {
        description: 'Recall from episodic memory',
        params: z.object({query: z.string().optional(), limit: z.number().optional()}),
        returns: z.any(),
        handler: async ({query, limit}: { query?: string; limit?: number }) => {
            return agent.recall(query, limit);
        },
    });

    registry.register('agent_know', {
        description: 'Store or retrieve knowledge',
        params: z.object({key: z.string(), value: z.string().optional()}),
        returns: z.any(),
        handler: async ({key, value}: { key: string; value?: string }) => {
            if (value !== undefined) {
                agent.know(key, value);
                return {stored: true, key, value};
            }
            return {key, value: agent.knowGet(key)};
        },
    });

    registry.register('agent_lm_rule_enable', {
        description: 'Enable an LM rule',
        params: z.object({id: z.string()}),
        returns: z.any(),
        handler: async ({id}: { id: string }) => {
            agent.enableLmRule(id);
            return {enabled: true, id};
        },
    });

    registry.register('agent_lm_rule_disable', {
        description: 'Disable an LM rule',
        params: z.object({id: z.string()}),
        returns: z.any(),
        handler: async ({id}: { id: string }) => {
            agent.disableLmRule(id);
            return {disabled: true, id};
        },
    });

    registry.register('agent_explain', {
        description: 'Explain a belief or goal',
        params: z.object({term: z.string(), type: z.enum(['belief', 'goal']).optional()}),
        returns: z.any(),
        handler: async ({term, type}: { term: string; type?: 'belief' | 'goal' }) => {
            if (type === 'goal') {
                return agent.explainGoal(term);
            }
            return agent.explainBelief(term);
        },
    });

    registry.register('agent_goal_progress', {
        description: 'Get goal progress or list active goals',
        params: z.object({goalId: z.string().optional()}),
        returns: z.any(),
        handler: async ({goalId}: { goalId?: string }) => {
            if (goalId) return agent.getGoalProgress(goalId);
            return agent.listActiveGoals();
        },
    });
}
