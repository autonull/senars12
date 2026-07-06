import {BaseProvider} from './BaseProvider.js';

export class HuggingFaceProvider extends BaseProvider {
    constructor(config = {}) {
        super(config);
        this.modelName = config.modelName || 'sshleifer/distilbart-cnn-12-6';
        this.device = config.device || 'cpu';

        this.modelType = this._getModelType(this.modelName);
        this.pipeline = null;
        this.tokenizer = null;
        this.model = null;
        this.initialized = false;
    }

    _getModelType(modelName) {
        return modelName.includes('MobileBERT') ? 'mobilebert' :
            modelName.includes('SmolLM') ? 'smollm' : 'generic';
    }

    async _initializeModel() {
        if (this.initialized) {
            return;
        }

        try {
            const {pipeline, AutoTokenizer, AutoModelForCausalLM} = await import('@huggingface/transformers');

            switch (this.modelType) {
                case 'smollm':
                    this.pipeline = await pipeline('text-generation', this.modelName, {device: this.device});
                    break;
                case 'mobilebert':
                    this.tokenizer = await AutoTokenizer.from_pretrained(this.modelName);
                    this.model = await AutoModelForCausalLM.from_pretrained(this.modelName);
                    break;
                default:
                    this.pipeline = await pipeline('text-generation', this.modelName, {device: this.device});
            }

            this.initialized = true;
        } catch (error) {
            throw new Error(`HuggingFaceProvider initialization failed: ${error.message}`);
        }
    }

    async generateText(prompt, options = {}) {
        await this._initializeModel();

        if (!this.pipeline) {
            throw new Error('Model pipeline not available after initialization.');
        }

        const temperature = options.temperature ?? this.temperature;
        const maxTokens = options.maxTokens ?? this.maxTokens;

        try {
            const response = await this.pipeline(prompt, {
                max_new_tokens: maxTokens,
                temperature,
                do_sample: temperature > 0,
                pad_token_id: 50256,
                ...options
            });

            return this._extractTextFromResponse(response);
        } catch (error) {
            throw new Error(`HuggingFaceProvider generateText failed: ${error.message}`);
        }
    }

    _extractTextFromResponse(response) {
        if (Array.isArray(response) && response.length > 0) {
            return response[0].generated_text || response[0].text || response[0];
        }

        if (typeof response === 'string') {
            return response;
        }

        if (response?.generated_text) {
            return response.generated_text;
        }

        return JSON.stringify(response);
    }

    async generateEmbedding(text) {
        await this._initializeModel();

        try {
            const {pipeline} = await import('@huggingface/transformers');
            const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {device: this.device});
            const output = await extractor(text, {pooling: 'mean', normalize: true});
            return Array.from(output.data || output);
        } catch (error) {
            throw new Error(`HuggingFaceProvider generateEmbedding failed: ${error.message}`);
        }
    }
}
