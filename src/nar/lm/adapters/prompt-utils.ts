/**
 * Helpers for converting between the Vercel AI SDK V2 prompt structure and
 * the flat string-prompt form our `LMClient` interface expects.
 *
 * The V2 spec stores a per-role `content`:
 *   - `system` -> string
 *   - `user` / `assistant` -> array of text/file/tool parts
 *   - `tool` -> array of tool-result parts
 *
 * A naïve `(content ?? []).map(...)` blows up on system messages. The two
 * helpers below centralize the structural work so `AISDKAdapter` and any
 * other code that needs to render the conversation only deals with the
 * high-level intent.
 */

type V2Role = 'system' | 'user' | 'assistant' | 'tool';

export interface V2Message {
    role: V2Role;
    content: string | Array<Record<string, unknown>>;
    providerOptions?: Record<string, unknown>;
}

export interface V2Tool {
    type: string;
    name: string;
    description?: string;
    inputSchema?: unknown;
}

const ROLE_PREFIX: Record<V2Role, string> = {
    system: 'System',
    user: 'Human',
    assistant: 'Assistant',
    tool: 'Tool',
};

export function textFromContent(content: string | Array<Record<string, unknown>>): string {
    if (typeof content === 'string') return content;
    const parts: string[] = [];
    for (const part of content) {
        const type = part.type as string;
        if (type === 'text' && typeof part.text === 'string') {
            parts.push(part.text);
        } else if (type === 'tool-call' || type === 'tool_use') {
            const name = (part.toolName ?? part.name) as string | undefined;
            const args = (part.input ?? part.args) as Record<string, unknown> | undefined;
            parts.push(`[calling tool ${name ?? '?'}: ${JSON.stringify(args ?? {})}]`);
        } else if (type === 'tool-result') {
            const name = (part.toolName ?? part.name) as string | undefined;
            parts.push(`[tool ${name ?? '?'} returned: ${JSON.stringify(part.result ?? part.output ?? '')}]`);
        } else if (type === 'reasoning' && typeof part.text === 'string') {
            parts.push(`[reasoning: ${part.text}]`);
        }
    }
    return parts.join('');
}

/**
 * Pull the system prompt out of the message list. V2 allows it inline
 * (role: 'system') or via the call-level `system` option; this helper
 * handles both. The system prompt is removed from the returned list.
 */
export function extractSystemPrompt(prompt: V2Message[]): {system: string; messages: V2Message[]} {
    let system = '';
    const messages: V2Message[] = [];
    for (const msg of prompt) {
        if (msg.role === 'system') {
            system += (system ? '\n' : '') + textFromContent(msg.content);
        } else {
            messages.push(msg);
        }
    }
    return {system, messages};
}

const TOOL_INSTRUCTION_HEADER = [
    'You have access to tools. When a tool would help, you may emit a JSON object of the form',
    '{"name": "<tool-name>", "arguments": {<args>}} on its own line. Otherwise reply normally.',
].join(' ');

export function buildJsonToolSystemPrompt(system: string | undefined, tools: V2Tool[]): string {
    const parts: string[] = [];
    if (system) parts.push(system.trim());
    if (tools.length > 0) {
        const toolList = tools
            .map((tool) => `- ${tool.name}${tool.description ? `: ${tool.description}` : ''}`)
            .join('\n');
        parts.push(`${TOOL_INSTRUCTION_HEADER}\nAvailable tools:\n${toolList}`);
    }
    return parts.join('\n\n');
}

/**
 * Render the conversation as a single string suitable for any model that
 * only takes a flat prompt (i.e. the entire `LMClient` family). The
 * template uses `### ` markers to make role boundaries unambiguous for
 * base/chat models alike.
 */
export function formatV2Prompt(messages: V2Message[], systemPrompt?: string): string {
    const blocks: string[] = [];
    if (systemPrompt?.trim()) {
        blocks.push(`### System\n${systemPrompt.trim()}`);
    }
    for (const msg of messages) {
        const text = textFromContent(msg.content);
        if (!text) continue;
        blocks.push(`### ${ROLE_PREFIX[msg.role]}\n${text}`);
    }
    return blocks.join('\n\n');
}
