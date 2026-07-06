import { TransformersJSProvider, DummyProvider } from './index.js';
import { LangChainProvider } from './LangChainProvider.js';
import { HuggingFaceProvider } from './HuggingFaceProvider.js';

export class LMConfig {
    static PROVIDERS = Object.freeze({
        TRANSFORMERS: 'transformers',
        OLLAMA: 'ollama',
        OPENAI: 'openai',
        HUGGINGFACE: 'huggingface',
        DUMMY: 'dummy'
    });

    static DEFAULT_PROVIDERS = {
        ollama: {
            name: 'Ollama (OpenAI-compatible)',
            type: 'ollama',
            defaultConfig: { modelName: 'llama2', baseURL: 'http://localhost:11434' }
        },
        openai: {
            name: 'OpenAI',
            type: 'openai',
            defaultConfig: { modelName: 'gpt-3.5-turbo' }
        },
        huggingface: {
            name: 'Hugging Face Transformers',
            type: 'huggingface',
            defaultConfig: { modelName: 'HuggingFaceTB/SmolLM-135M-Instruct', device: 'cpu' },
            presets: {
                'SmolLM': ['HuggingFaceTB/SmolLM-135M-Instruct', 'HuggingFaceTB/SmolLM-360M-Instruct', 'HuggingFaceTB/SmolLM-1.7B-Instruct'],
                'Granite': ['ibm-granite/granite-3.0-8b-instruct', 'ibm-granite/granite-3.0-2b-instruct'],
                'Mistral': ['mistral/mistral-tiny', 'mistral/mistral-small', 'microsoft/DialoGPT-small']
            }
        },
        anthropic: {
            name: 'Anthropic (via LangChain)',
            type: 'anthropic',
            defaultConfig: { modelName: 'claude-3-haiku' }
        },
        transformers: {
            name: 'Transformers.js (local)',
            type: 'transformers',
            defaultConfig: { model: 'Xenova/all-MiniLM-L6-v2' }
        },
        dummy: {
            name: 'Dummy/Null Provider',
            type: 'dummy',
            defaultConfig: { id: 'dummy' }
        }
    };

    constructor(options = {}) {
        this.configs = new Map();
        this.active = null;
        this.persistPath = options.persistPath ?? '.senars-lm-config.json';

        this.setProvider(LMConfig.PROVIDERS.TRANSFORMERS, { model: 'Xenova/all-MiniLM-L6-v2', type: 'transformers' });
        this.setProvider(LMConfig.PROVIDERS.DUMMY, { type: 'dummy' });
        this.setActive(LMConfig.PROVIDERS.TRANSFORMERS);
    }

    static fromJSON(json) {
        const config = new LMConfig({ persistPath: json.persistPath });
        config.active = json.active;
        config.configs = new Map(Object.entries(json.providers ?? {}));
        return config;
    }

    static bindTools(provider, agent) {
        if (!agent?.tools?.registry) {
            provider.tools = [];
            return;
        }

        const registeredTools = agent.tools.registry.getDiscoveredTools() || [];
        const tools = registeredTools.map(tool => ({
            name: tool.id,
            description: tool.description,
            schema: tool.parameters ?? tool.schema,
            invoke: async (args) => {
                const result = await agent.tools.executeTool(tool.id, args);
                return result?.result !== undefined
                    ? typeof result.result === 'string' ? result.result : JSON.stringify(result.result)
                    : JSON.stringify(result);
            }
        }));

        provider.tools = tools;
        if (typeof provider.bindTools === 'function') {provider.bindTools(tools);}
    }

    setProvider(name, config) {
        this.configs.set(name, { name, ...config, enabled: config.enabled ?? true });
    }

    getProvider(name) {
        return this.configs.get(name) ?? null;
    }

    setActive(name) {
        if (!this.configs.has(name)) {throw new Error(`Provider ${name} not configured`);}
        this.active = name;
    }

    getActive() {
        if (!this.active) {throw new Error('No active provider set');}
        return this.configs.get(this.active);
    }

    listProviders() {
        return Array.from(this.configs.keys());
    }

    async test(name = this.active) {
        if (!name) {return { success: false, message: 'No provider specified' };}

        const config = this.getProvider(name);
        if (!config) {return { success: false, message: `Provider ${name} not found` };}

        try {
            const provider = this._createProvider(config);
            if (provider.embed) {await provider.embed('test');}
            else if (provider.complete) {await provider.complete('test');}
            return { success: true, message: 'Connection successful' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }


    createActiveProvider() {
        return this._createProvider(this.getActive());
    }

    isConfigured(name) {
        return this.configs.has(name);
    }

    getActiveProviderName() {
        return this.active;
    }

    clearAll() {
        this.configs.clear();
        this.active = null;
    }

    _createProvider(config) {
        if (!config) {throw new Error('Cannot create provider from null config');}

        const type = config.type ?? config.name;
        const { TRANSFORMERS, DUMMY, OLLAMA, OPENAI, HUGGINGFACE, ANTHROPIC } = LMConfig.PROVIDERS;

        if (type === 'transformers' || type === TRANSFORMERS) {return new TransformersJSProvider(config);}
        if (type === 'dummy' || type === DUMMY) {return new DummyProvider(config);}

        if (type === 'ollama' || type === OLLAMA || type === 'openai' || type === OPENAI || type === 'anthropic' || type === ANTHROPIC) {
            return new LangChainProvider({ ...config, provider: type });
        }

        if (type === 'huggingface' || type === HUGGINGFACE) {
            return new HuggingFaceProvider(config);
        }

        throw new Error(`Unknown provider type: ${type}`);
    }

    toJSON() {
        return {
            active: this.active,
            providers: Object.fromEntries(this.configs),
            version: '1.0.0'
        };
    }
}
