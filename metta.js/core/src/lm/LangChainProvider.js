// Third-party imports
import {AIMessage, HumanMessage} from '@langchain/core/messages';
import {DynamicTool} from '@langchain/core/tools';
import {END, START, StateGraph} from '@langchain/langgraph';
import {ToolNode} from '@langchain/langgraph/prebuilt';
import {z} from 'zod';

// Local imports
import {BaseProvider} from './BaseProvider.js';
import {ModelFactory} from './ModelFactory.js';
import {Logger} from '../util/Logger.js';
import {
    ConfigurationError,
    ConnectionError as ProviderConnectionError,
    InitializationError,
    ModelNotFoundError as ProviderModelNotFoundError,
    TimeoutError,
    ProviderError
} from './ProviderError.js';

export class LangChainProvider extends BaseProvider {
    constructor(config = {}) {
        super({...config, maxTokens: config.maxTokens ?? 1000});
        this._validateConfig(config);
        this.providerType = config.provider ?? 'ollama';
        if (!config.modelName) {
            throw new ConfigurationError('modelName is required for LangChainProvider', 'modelName');
        }
        this.modelName = config.modelName;
        this.apiKey = config.apiKey;
        this.baseURL = this._normalizeBaseUrl(config.baseURL ?? 'http://localhost:11434');
        this.tools = config.tools || [];
    }

    _validateConfig(config) {
        config.provider = config.provider || 'ollama';

        if (config.provider === 'openai' && !config.apiKey) {
            throw new ConfigurationError('API key is required for OpenAI provider', 'apiKey');
        }

        if (!['ollama', 'openai'].includes(config.provider)) {
            throw new ConfigurationError(`Unsupported provider type: ${config.provider}. Use 'ollama' or 'openai'.`, 'provider');
        }
    }

    initialize() {
        this._initAgent();
    }

    _convertToLangchainTools(tools) {
        return tools.map(tool => this._convertTool(tool));
    }

    _convertTool(tool) {
        // If it's already a LangChain tool, return as-is
        if (tool.invoke && typeof tool.invoke === 'function') {
            return tool;
        }

        // Convert our custom tool to a LangChain DynamicTool
        return new DynamicTool({
            name: tool.name || tool.constructor.name,
            description: tool.description || 'A tool for the language model',
            func: async (input) => this._executeConvertedTool(tool, input),
            schema: tool.schema || {type: 'object', properties: {}, required: []}
        });
    }

    async _executeConvertedTool(tool, input) {
        try {
            // Handle both string input and object input
            let args = input;
            if (typeof input === 'string') {
                try {
                    args = JSON.parse(input);
                } catch (error) {
                    Logger.debug('Failed to parse tool input as JSON, using as plain string', {input});
                    args = {content: input};
                }
            }
            const result = await (typeof tool.execute === 'function'
                ? tool.execute(args)
                : {error: 'Tool has no execute method'});
            return JSON.stringify(result);
        } catch (error) {
            return JSON.stringify({error: error.message});
        }
    }

    _normalizeBaseUrl(baseURL) {
        return baseURL.includes(':11434') && !baseURL.startsWith('http')
            ? `http://${baseURL}`
            : baseURL;
    }

    _initModelAndTools() {
        const tools = this._convertToLangchainTools(this.tools);
        const hasTools = tools?.length > 0;

        let model;
        let modelWithTools;

        try {
            model = ModelFactory.createModel(this.providerType, {
                modelName: this.modelName,
                apiKey: this.apiKey,
                baseURL: this.baseURL,
                temperature: this.temperature,
                maxTokens: this.maxTokens,
                ollamaOptions: this.config.ollamaOptions,
                openaiOptions: this.config.openaiOptions
            });

            if (hasTools) {
                try {
                    // Attempt to bind tools - if the model doesn't support tools, this will cause issues
                    modelWithTools = model.bindTools(tools);
                } catch (bindError) {
                    console.warn(`⚠️  Model ${this.modelName} may not support tools, proceeding without tools: ${bindError.message}`);
                    modelWithTools = model;
                }
            } else {
                modelWithTools = model;
            }
        } catch (error) {
            const initError = error instanceof InitializationError
                ? error
                : new InitializationError(`Failed to initialize model ${this.modelName}: ${error.message}`, this.providerType);
            console.error(`❌ ${initError.message}`);
            throw initError;
        }

        return {modelWithTools, tools, hasTools};
    }

    _createAgentNode(modelWithTools) {
        return async (state) => {
            try {
                const messages = await modelWithTools.invoke(state.messages);
                return {messages: [messages]};
            } catch (invokeError) {
                console.error(`Error during model invocation:`, invokeError.message);
                return {
                    messages: [new AIMessage({
                        content: `Error: ${invokeError.message}`
                    })]
                };
            }
        };
    }

    _initAgent() {
        const {modelWithTools, tools, hasTools} = this._initModelAndTools();
        const agentNode = this._createAgentNode(modelWithTools);
        const toolNode = hasTools ? new ToolNode(tools) : null;

        const AgentState = z.object({
            messages: z.array(z.any()).default([]),
        });

        const workflow = new StateGraph(AgentState);

        workflow.addNode("agent", agentNode);
        if (hasTools) {
            workflow.addNode("tools", toolNode);
        }

        workflow.addEdge(START, "agent");

        if (hasTools) {
            workflow.addConditionalEdges("agent", (state) => {
                const lastMsg = state.messages?.[state.messages.length - 1];
                return lastMsg?.tool_calls?.length > 0 ? "tools" : END;
            });
            workflow.addEdge("tools", "agent");
        } else {
            workflow.addEdge("agent", END);
        }

        this.agent = workflow.compile();
    }

    async generateText(prompt, options = {}) {
        if (!this.agent) {
            throw new Error('Agent not initialized. Please call initialize() first.');
        }

        const timeout = options.timeout || 30000;

        return Promise.race([
            this._executeGenerateText(prompt),
            this._createTimeoutPromise(timeout)
        ]);
    }

    async _executeGenerateText(prompt) {
        try {
            const response = await this.agent.invoke({
                messages: [new HumanMessage(prompt)],
            });

            if (response.messages?.length > 0) {
                const lastMessage = response.messages[response.messages.length - 1];
                return lastMessage.content || JSON.stringify(lastMessage);
            }
            return 'No response generated';
        } catch (error) {
            return this._handleError(error);
        }
    }

    _createTimeoutPromise(timeout) {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new TimeoutError('generateText', timeout)), timeout)
        );
    }

    async streamText(prompt, options = {}) {
        if (!this.agent) {
            throw new Error('Agent not initialized. Please call initialize() first.');
        }

        const timeout = options.timeout || 60000;

        return {
            async* [Symbol.asyncIterator]() {
                const timeoutController = new TimeoutController(timeout);

                try {
                    const stream = this.agent.stream(
                        {messages: [new HumanMessage(prompt)]},
                        {streamMode: 'values'}
                    );

                    for await (const chunk of stream) {
                        timeoutController.reset();

                        if (chunk?.messages?.length > 0) {
                            const lastMessage = chunk.messages[chunk.messages.length - 1];
                            if (lastMessage?.content) {
                                yield lastMessage.content;
                            }
                        }

                        timeoutController.reset();
                    }

                    timeoutController.clear();
                } catch (error) {
                    timeoutController.clear();
                    throw this._handleError(error);
                }
            }
        };
    }

    _handleError(error) {
        if (error.message?.includes('model') && error.message?.includes('not found')) {
            throw new ProviderModelNotFoundError(this.modelName);
        } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
            throw new ProviderConnectionError(`Connection to ${this.providerType} service failed. Please ensure the service is running at ${this.baseURL}`, this.providerType, this.baseURL);
        } else if (error instanceof ProviderError) {
            throw error; // Re-throw if it's already a specialized error
        } else {
            throw new Error(`LangChainProvider operation failed: ${error.message}`);
        }
    }

    async generateEmbedding() {
        throw new Error("Embeddings not fully implemented for LangChainProvider due to LangChain's varied embedding support across providers");
    }
}

// Helper class for managing timeouts
class TimeoutController {
    constructor(timeout) {
        this.timeout = timeout;
        this.timeoutId = null;
        this.reset();
    }

    reset() {
        this.clear();
        this.timeoutId = setTimeout(() => {
            throw new Error(`Request timed out after ${this.timeout}ms`);
        }, this.timeout);
    }

    clear() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
}