import {BaseChatModel} from "@langchain/core/language_models/chat_models";
import {AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage} from "@langchain/core/messages";
import {ChatGenerationChunk} from "@langchain/core/outputs";
import {Logger} from '../util/Logger.js';

/**
 * Wrapper for Transformers.js to behave like a LangChain ChatModel.
 * Supports tool calling via prompt engineering and output parsing.
 */
export class TransformersJSModel extends BaseChatModel {
    constructor(fields = {}) {
        super(fields);
        this.modelName = fields.modelName ?? 'Xenova/LaMini-Flan-T5-783M';
        this.task = fields.task ?? 'text2text-generation';
        this.device = fields.device ?? 'cpu';
        this.temperature = fields.temperature ?? 0;
        this.maxTokens = fields.maxTokens ?? 512;
        this.pipeline = null;
        this.boundTools = [];
    }

    _llmType() {
        return "transformers_js";
    }

    async _initialize() {
        if (this.pipeline) {
            return;
        }

        // Suppress ONNX Runtime warnings
        process.env.ORT_LOG_LEVEL ??= '3';

        const {pipeline} = await import('@huggingface/transformers');

        this.pipeline = await pipeline(this.task, this.modelName, {
            device: this.device,
            quantized: true
        });
    }


    bindTools(tools) {
        this.boundTools = tools;
        return this;
    }

    async generateText(prompt, options = {}) {
        await this._initialize();
        const output = await this.pipeline(prompt, {
            max_new_tokens: this.maxTokens,
            temperature: this.temperature,
            do_sample: this.temperature > 0,
        });
        const res = Array.isArray(output) ? output[0] : output;
        return res?.generated_text ?? res?.text ?? JSON.stringify(res);
    }

    async _generate(messages, options, runManager) {
        const {text, content, tool_calls} = await this._invoke(messages);
        return {
            generations: [{
                text: text,
                message: new AIMessage({content, tool_calls}),
            }],
        };
    }

    /**
     * Stream response chunks (simulated streaming)
     *
     * LIMITATION: True streaming not available with @huggingface/transformers.
     * The Transformers.js library does not expose a Streamer interface compatible
     * with LangChain's streaming protocol. This method simulates streaming by
     * yielding the complete response as a single chunk.
     *
     * For true streaming, would need:
     * - Access to Transformers.js internal generator/decoder
     * - Token-by-token emission during generation
     * - Integration with @huggingface/transformers Streamer (if/when available)
     */
    async* _streamResponseChunks(messages, options, runManager) {
        const {text, content, tool_calls} = await this._invoke(messages);

        if (tool_calls?.length > 0) {
            yield new ChatGenerationChunk({
                message: new AIMessageChunk({content: content ?? "", tool_calls}),
                text: text,
            });
        } else {
            yield new ChatGenerationChunk({
                message: new AIMessageChunk({content}),
                text: content,
            });
        }
    }

    async _invoke(messages) {
        const prompt = this._formatMessages(messages);
        await this._initialize();

        const output = await this.pipeline(prompt, {
            max_new_tokens: this.maxTokens,
            temperature: this.temperature,
            do_sample: this.temperature > 0,
        });

        const res = Array.isArray(output) ? output[0] : output;
        const text = res?.generated_text ?? res?.text ?? JSON.stringify(res);
        const parsed = this._parseOutput(text);

        return {text, ...parsed};
    }

    _formatMessages(messages) {
        const systemPrompt = this._buildToolPrompt(messages);
        const chatHistory = this._formatMessageHistory(messages);
        return `${systemPrompt}\n${chatHistory}\nAssistant:`;
    }

    _buildToolPrompt(messages) {
        let systemPrompt = messages.find(m => m instanceof SystemMessage)?.content ?? "";

        if (this.boundTools?.length > 0) {
            const toolDefs = this.boundTools.map(tool => {
                const schema = JSON.stringify(tool.schema ?? tool.parameters ?? {});
                return `- ${tool.name}: ${tool.description}. Arguments: ${schema}`;
            }).join('\n');

            systemPrompt = [
                "You are a helpful assistant. You have access to the following tools:",
                toolDefs,
                "\nTo use a tool, output exactly:\nAction: <tool_name>\nAction Input: <json_arguments>\n",
                "If no tool is needed, just provide the answer.\n",
                "Example:\nUser: Add 2 and 3\nAssistant:\nAction: calculator\nAction Input: {\"operation\": \"add\", \"a\": 2, \"b\": 3}\n\n",
                systemPrompt
            ].join('\n');
        }
        return systemPrompt;
    }

    _formatMessageHistory(messages) {
        return messages
            .filter(msg => !(msg instanceof SystemMessage))
            .map(msg => {
                if (msg instanceof HumanMessage) {
                    return `User: ${msg.content}`;
                }
                if (msg instanceof AIMessage) {
                    const toolCalls = msg.tool_calls?.map(tc => `Action: ${tc.name}\nAction Input: ${JSON.stringify(tc.args)}`).join('\n') ?? '';
                    return `Assistant: ${msg.content}${toolCalls ? `\n${toolCalls}` : ''}`;
                }
                if (msg instanceof ToolMessage) {
                    return `Tool Result: ${msg.content}`;
                }
                if (typeof msg === 'string') {
                    return `User: ${msg}`;
                }
                return '';
            })
            .join('\n');
    }

    _parseOutput(text) {
        const actionRegex = /Action:\s*(.+?)\s*Action Input:\s*({.+})/s;
        const match = text.match(actionRegex);

        if (!match) {
            return {content: text, tool_calls: []};
        }

        try {
            const [, toolName, argsString] = match;
            const args = JSON.parse(argsString.trim());
            const content = text.substring(0, match.index).trim();
            const tool_calls = [{
                name: toolName.trim(),
                args,
                id: `call_${Date.now()}` // Mock ID
            }];
            return {content, tool_calls};
        } catch (e) {
            Logger.warn('Failed to parse tool call, returning as text', {error: e.message});
            return {content: text, tool_calls: []};
        }
    }
}
