import type {NAR} from '../nar/nar.js';
import type {Agent} from '../agent/agent.js';
import type {EnhancedMCPAdapter} from './mcp/enhanced-adapter.js';

export function registerNARToolsAsMCP(nar: NAR, adapter: EnhancedMCPAdapter): void {
    const tools: Array<{name: string; description: string; inputSchema: Record<string, unknown>}> = [
        {
            name: 'calculate',
            description: 'Evaluate arithmetic/math expressions',
            inputSchema: {
                type: 'object',
                properties: {
                    expression: {type: 'string', description: 'Math expression to evaluate'},
                },
                required: ['expression'],
            },
        },
        {
            name: 'read_file',
            description: 'Read file contents',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {type: 'string', description: 'File path to read'},
                },
                required: ['path'],
            },
        },
        {
            name: 'write_file',
            description: 'Write content to file',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {type: 'string', description: 'File path to write'},
                    content: {type: 'string', description: 'Content to write'},
                },
                required: ['path', 'content'],
            },
        },
        {
            name: 'http_request',
            description: 'Make HTTP requests',
            inputSchema: {
                type: 'object',
                properties: {
                    method: {type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE']},
                    url: {type: 'string', description: 'URL to request'},
                    headers: {type: 'object', description: 'HTTP headers'},
                    body: {type: 'string', description: 'Request body'},
                },
                required: ['method', 'url'],
            },
        },
        {
            name: 'search_memory',
            description: 'Search NAR memory for beliefs',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {type: 'string', description: 'Search query'},
                },
                required: ['query'],
            },
        },
        {
            name: 'web_search',
            description: 'Search the web via Brave API',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {type: 'string', description: 'Web search query'},
                },
                required: ['query'],
            },
        },
        {
            name: 'run_reasoning',
            description: 'Run NAL inference steps',
            inputSchema: {
                type: 'object',
                properties: {
                    steps: {type: 'number', description: 'Number of reasoning steps'},
                },
                required: ['steps'],
            },
        },
        {
            name: 'explain_belief',
            description: 'Explain how a belief was derived',
            inputSchema: {
                type: 'object',
                properties: {
                    term: {type: 'string', description: 'Term to explain'},
                },
                required: ['term'],
            },
        },
        {
            name: 'learn_belief',
            description: 'Add a belief to memory',
            inputSchema: {
                type: 'object',
                properties: {
                    belief: {type: 'string', description: 'Belief in Narsese format'},
                },
                required: ['belief'],
            },
        },
        {
            name: 'set_timer',
            description: 'Set a timer/delay',
            inputSchema: {
                type: 'object',
                properties: {
                    ms: {type: 'number', description: 'Milliseconds to wait'},
                },
                required: ['ms'],
            },
        },
        {
            name: 'run_process',
            description: 'Execute a shell command',
            inputSchema: {
                type: 'object',
                properties: {
                    command: {type: 'string', description: 'Shell command to execute'},
                },
                required: ['command'],
            },
        },
    ];

    for (const tool of tools) {
        adapter.registerCapability({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema as any,
        });
    }
}

export function registerAgentAPI(agent: Agent, adapter: EnhancedMCPAdapter): void {
    adapter.registerCapability({
        name: 'agent_chat',
        description: 'Chat with the agent (non-streaming)',
        inputSchema: {
            type: 'object',
            properties: {
                input: {type: 'string', description: 'User input'},
                historyLimit: {type: 'number', description: 'Max history turns'},
            },
            required: ['input'],
        },
    });

    adapter.registerCapability({
        name: 'agent_chat_stream',
        description: 'Chat with the agent (streaming)',
        inputSchema: {
            type: 'object',
            properties: {
                input: {type: 'string', description: 'User input'},
                historyLimit: {type: 'number', description: 'Max history turns'},
            },
            required: ['input'],
        },
    });

    adapter.registerCapability({
        name: 'agent_believe',
        description: 'Add a belief to NAR memory',
        inputSchema: {
            type: 'object',
            properties: {
                narsese: {type: 'string', description: 'Belief in Narsese format'},
            },
            required: ['narsese'],
        },
    });

    adapter.registerCapability({
        name: 'agent_recall',
        description: 'Recall from episodic memory',
        inputSchema: {
            type: 'object',
            properties: {
                query: {type: 'string', description: 'Search query'},
                limit: {type: 'number', description: 'Max results', default: 10},
            },
        },
    });

    adapter.registerCapability({
        name: 'agent_know',
        description: 'Store or retrieve knowledge',
        inputSchema: {
            type: 'object',
            properties: {
                key: {type: 'string', description: 'Knowledge key'},
                value: {type: 'string', description: 'Knowledge value (omit to retrieve)'},
            },
            required: ['key'],
        },
    });

    adapter.registerCapability({
        name: 'agent_lm_rule_enable',
        description: 'Enable an LM rule',
        inputSchema: {
            type: 'object',
            properties: {
                id: {type: 'string', description: 'Rule ID'},
            },
            required: ['id'],
        },
    });

    adapter.registerCapability({
        name: 'agent_lm_rule_disable',
        description: 'Disable an LM rule',
        inputSchema: {
            type: 'object',
            properties: {
                id: {type: 'string', description: 'Rule ID'},
            },
            required: ['id'],
        },
    });

    adapter.registerCapability({
        name: 'agent_explain',
        description: 'Explain a belief or goal',
        inputSchema: {
            type: 'object',
            properties: {
                term: {type: 'string', description: 'Term to explain'},
                type: {type: 'string', enum: ['belief', 'goal'], default: 'belief'},
            },
            required: ['term'],
        },
    });

    adapter.registerCapability({
        name: 'agent_explain_nl',
        description: 'Explain in natural language',
        inputSchema: {
            type: 'object',
            properties: {
                term: {type: 'string', description: 'Term to explain'},
            },
            required: ['term'],
        },
    });

    adapter.registerCapability({
        name: 'agent_goal_progress',
        description: 'Get goal progress or list active goals',
        inputSchema: {
            type: 'object',
            properties: {
                goalId: {type: 'string', description: 'Goal ID (omit to list all)'},
            },
        },
    });

    // Legacy tools for compatibility
    adapter.registerCapability({
        name: 'get_beliefs',
        description: 'Get all beliefs from NAR memory',
        inputSchema: {type: 'object', properties: {}},
    });

    adapter.registerCapability({
        name: 'get_attention',
        description: 'Get current attention snapshot',
        inputSchema: {type: 'object', properties: {}},
    });
}