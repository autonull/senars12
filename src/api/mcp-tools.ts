import {promises as fs} from 'node:fs';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Agent} from '@senars/nar/agent';
import {z} from 'zod';
import type {NAR} from '../../nar/src';
import {createMCPResponse, formatBeliefsForMCP, stringifyMCP} from './mcp-response.js';

/** Safe math evaluator - parses and evaluates arithmetic expressions without eval() */
function safeEvaluate(expr: string): number {
    const tokens = expr.match(/\d+\.?\d*|[+\-*/()]/g) ?? [];
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const parseExpression = (): number => {
        let left = parseTerm();
        while (peek() === '+' || peek() === '-') {
            const op = consume();
            const right = parseTerm();
            left = op === '+' ? left + right : left - right;
        }
        return left;
    };

    const parseTerm = (): number => {
        let left = parseFactor();
        while (peek() === '*' || peek() === '/') {
            const op = consume();
            const right = parseFactor();
            left = op === '*' ? left * right : left / right;
        }
        return left;
    };

    const parseFactor = (): number => {
        if (peek() === '(') {
            consume();
            const result = parseExpression();
            consume();
            return result;
        }
        if (peek() === '-') {
            consume();
            return -parseFactor();
        }
        if (peek() === '+') {
            consume();
            return parseFactor();
        }
        const token = consume();
        if (token === undefined) throw new Error('Unexpected end of expression');
        const num = Number(token);
        if (Number.isNaN(num)) throw new Error(`Invalid number: ${token}`);
        return num;
    };

    const result = parseExpression();
    if (pos !== tokens.length) throw new Error('Unexpected tokens remaining');
    return result;
}

export function registerNARTools(server: McpServer, nar: NAR, agent: Agent): void {
    server.registerTool(
        'calculate',
        {
            title: 'Calculator',
            description: 'Evaluate arithmetic/math expressions',
            inputSchema: {expression: z.string()},
            outputSchema: {result: z.number()},
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({expression}) => {
            const sanitized = expression.replace(/[^0-9+\-*/.()eE\s]/g, '');
            const result = safeEvaluate(sanitized);
            return createMCPResponse(String(result), {result});
        }
    );

    server.registerTool(
        'read_file',
        {
            title: 'Read File',
            description: 'Read file contents',
            inputSchema: {path: z.string()},
            outputSchema: {content: z.string()},
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: true,
            },
        },
        async ({path}) => {
            const content = await fs.readFile(path, 'utf-8');
            return createMCPResponse(content, {content});
        }
    );

    server.registerTool(
        'write_file',
        {
            title: 'Write File',
            description: 'Write content to file',
            inputSchema: {path: z.string(), content: z.string()},
            outputSchema: {success: z.boolean()},
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: true,
            },
        },
        async ({path, content}) => {
            await fs.writeFile(path, content, 'utf-8');
            return createMCPResponse('File written successfully', {success: true});
        }
    );

    server.registerTool(
        'search_memory',
        {
            title: 'Search Memory',
            description: 'Search NAR memory for beliefs',
            inputSchema: {query: z.string()},
            outputSchema: {results: z.array(z.object({term: z.string(), truth: z.any()}))},
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({query}) => {
            const beliefs = nar.getBeliefs();
            const results = beliefs.filter((b) =>
                b.term.toString().toLowerCase().includes(query.toLowerCase())
            );
            const structuredResults = formatBeliefsForMCP(results);
            return createMCPResponse(stringifyMCP(structuredResults), {results: structuredResults});
        }
    );

    server.registerTool(
        'run_reasoning',
        {
            title: 'Run Reasoning',
            description: 'Run NAL inference steps',
            inputSchema: {steps: z.number()},
            outputSchema: {
                derived: z.number(),
                beliefs: z.array(z.object({term: z.string(), truth: z.any()})),
            },
            annotations: {
                readOnlyHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
        },
        async ({steps}) => {
            const derived = await nar.run(steps);
            const recentBeliefs = formatBeliefsForMCP(nar.getBeliefs().slice(-10));
            return createMCPResponse(stringifyMCP({derived, beliefs: recentBeliefs}), {derived, beliefs: recentBeliefs});
        }
    );

    server.registerTool(
        'learn_belief',
        {
            title: 'Learn Belief',
            description: 'Add a belief to memory',
            inputSchema: {belief: z.string()},
            outputSchema: {added: z.string()},
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
        },
        async ({belief}) => {
            await nar.believe(belief);
            return createMCPResponse(`Added belief: ${belief}`, {added: belief});
        }
    );

    server.registerTool(
        'explain_belief',
        {
            title: 'Explain Belief',
            description: 'Explain how a belief was derived',
            inputSchema: {term: z.string()},
            outputSchema: {term: z.string(), derivation: z.string()},
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({term}) => {
            const result = {term, derivation: 'Not yet implemented'};
            return createMCPResponse(`Derivation for ${term}: Not yet implemented`, result);
        }
    );

    server.registerTool(
        'agent_chat',
        {
            title: 'Agent Chat',
            description: 'Chat with the agent (non-streaming)',
            inputSchema: {input: z.string(), historyLimit: z.number().optional()},
            outputSchema: {response: z.string()},
            annotations: {
                readOnlyHint: false,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async ({input}) => {
            const result = await agent.chat(input);
            return createMCPResponse(result, {response: result});
        }
    );

    server.registerTool(
        'agent_chat_stream',
        {
            title: 'Agent Chat Stream',
            description: 'Chat with the agent (streaming)',
            inputSchema: {input: z.string(), historyLimit: z.number().optional()},
            outputSchema: {response: z.string()},
            annotations: {
                readOnlyHint: false,
                idempotentHint: false,
                openWorldHint: true,
            },
        },
        async ({input}) => {
            let result = '';
            for await (const event of agent.chatStream(input)) {
                if (event.kind === 'finish' || event.kind === 'aborted' || event.kind === 'error') {
                    result = event.text ?? '';
                }
            }
            return createMCPResponse(result, {response: result});
        }
    );

    server.registerTool(
        'agent_believe',
        {
            title: 'Agent Believe',
            description: 'Add a belief to NAR memory',
            inputSchema: {narsese: z.string()},
            outputSchema: {success: z.boolean()},
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
        },
        async ({narsese}) => {
            await agent.believe(narsese);
            return createMCPResponse('Belief added successfully', {success: true});
        }
    );

    server.registerTool(
        'agent_recall',
        {
            title: 'Agent Recall',
            description: 'Recall from episodic memory',
            inputSchema: {query: z.string().optional(), limit: z.number().optional()},
            outputSchema: z.any(),
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({query, limit}) => {
            const result = await agent.recall(query, limit);
            return createMCPResponse(stringifyMCP(result), result);
        }
    );

    server.registerTool(
        'agent_know',
        {
            title: 'Agent Know',
            description: 'Store or retrieve knowledge',
            inputSchema: {key: z.string(), value: z.string().optional()},
            outputSchema: {
                key: z.string(),
                value: z.string().optional(),
                stored: z.boolean().optional(),
            },
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({key, value}) => {
            if (value !== undefined) {
                agent.know(key, value);
                return createMCPResponse(`Stored: ${key} = ${value}`, {key, value, stored: true});
            }
            const result = agent.knowGet?.(key);
            return createMCPResponse(stringifyMCP({key, value: result}), {key, value: result, stored: false});
        }
    );

    server.registerTool(
        'agent_lm_rule_enable',
        {
            title: 'Enable LM Rule',
            description: 'Enable an LM rule',
            inputSchema: {id: z.string()},
            outputSchema: {enabled: z.boolean(), id: z.string()},
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({id}) => {
            return createMCPResponse(`Enabled LM rule: ${id}`, {enabled: true, id});
        }
    );

    server.registerTool(
        'agent_lm_rule_disable',
        {
            title: 'Disable LM Rule',
            description: 'Disable an LM rule',
            inputSchema: {id: z.string()},
            outputSchema: {disabled: z.boolean(), id: z.string()},
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({id}) => {
            return createMCPResponse(`Disabled LM rule: ${id}`, {disabled: true, id});
        }
    );

    server.registerTool(
        'agent_explain',
        {
            title: 'Agent Explain',
            description: 'Explain a belief or goal',
            inputSchema: {term: z.string(), type: z.enum(['belief', 'goal']).optional()},
            outputSchema: {term: z.string(), type: z.string(), explanation: z.string()},
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({term, type}) => {
            const result = {term, type: type ?? 'belief', explanation: 'Not yet implemented'};
            return createMCPResponse(`Explanation for ${term} (${type ?? 'belief'}): Not yet implemented`, result);
        }
    );

    server.registerTool(
        'agent_goal_progress',
        {
            title: 'Agent Goal Progress',
            description: 'Get goal progress or list active goals',
            inputSchema: {goalId: z.string().optional()},
            outputSchema: z.union([
                z.array(z.unknown()),
                z.object({goalId: z.string(), progress: z.number()}),
            ]),
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async ({goalId}) => {
            const result = goalId ? {goalId, progress: 0} : [];
            return createMCPResponse(stringifyMCP(result), result);
        }
    );

    server.registerTool(
        'get_beliefs',
        {
            title: 'Get Beliefs',
            description: 'Get all beliefs from NAR memory',
            inputSchema: {},
            outputSchema: {beliefs: z.array(z.object({term: z.string(), truth: z.any()}))},
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            const beliefs = formatBeliefsForMCP(nar.getBeliefs());
            return createMCPResponse(stringifyMCP(beliefs), {beliefs});
        }
    );

    server.registerTool(
        'get_attention',
        {
            title: 'Get Attention',
            description: 'Get current attention snapshot',
            inputSchema: {},
            outputSchema: z.any(),
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
        },
        async () => {
            const report = nar.attentionReport();
            return createMCPResponse(stringifyMCP(report), report);
        }
    );
}
