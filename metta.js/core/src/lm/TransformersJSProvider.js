import {BaseProvider} from './BaseProvider.js';
import {withTimeout} from '../util/async.js';

let pipelinePromise = null;
const importPipeline = () => {
    if (!pipelinePromise) {
        pipelinePromise = import('@huggingface/transformers').then(mod => mod.pipeline);
    }
    return pipelinePromise;
};

export class TransformersJSProvider extends BaseProvider {
    constructor(config = {}) {
        super(config);
        this.modelName = config.modelName ?? 'HuggingFaceTB/SmolLM2-1.7B-Instruct';
        this.task = config.task ?? this._inferTask(this.modelName);
        this.device = config.device ?? 'cpu';
        this.pipeline = null;
        this.tools = config.tools || [];
    }

    _inferTask(modelName) {
        const lower = modelName.toLowerCase();
        if (lower.includes('t5') || lower.includes('bart') || lower.includes('flan')) {
            return 'text2text-generation';
        }
        return 'text-generation';
    }

    _contentToStr(c) {
        if (typeof c === 'string') {return c;}
        if (Array.isArray(c)) {return c.map(x => typeof x === 'string' ? x : (x.text || '')).join('');}
        if (c && typeof c === 'object') {return c.text || '';}
        return String(c);
    }

    _formatChatPrompt(messages) {
        if (!Array.isArray(messages)) {return String(messages);}
        const content = (m) => this._contentToStr(m.content);
        if (this.task === 'text2text-generation') {return messages.map(content).join('\n');}
        const CT = '\x3c\x7c\x69\x6d\x5f\x73\x74\x61\x72\x74\x7c\x3e';
        const ET = '\x3c\x7c\x69\x6d\x5f\x65\x6e\x64\x7c\x3e';
        const fmt = (m) => `${CT}${m.role || 'user'}\n${content(m)}${ET}`;
        return `${messages.map(fmt).join('\n')  }\n${CT}assistant\n`;
    }

    async _initialize() {
        if (this.pipeline) {return;}
        const startTime = Date.now();
        this._emitEvent('lm:model-load-start', {modelName: this.modelName, task: this.task});
        try {
            const pipeline = await importPipeline();
            // Suppress transformers.js dtype warning (fp32 default is fine)
            const origWarn = console.warn;
            console.warn = () => {};
            try {
                const loadModelPromise = pipeline(this.task, this.modelName, {
                    device: this.device,
                    progress_callback: (progress) => {
                        if (progress && typeof progress === 'object' && progress.status === 'progress') {
                            this._emitEvent('lm:model-dl-progress', {
                                modelName: this.modelName,
                                fileName: progress.file,
                                progress: Math.round(progress.progress)
                            });
                        }
                    }
                });
                this.pipeline = await withTimeout(loadModelPromise, this.loadTimeout, `Model loading (${this.modelName})`);
            } finally {
                console.warn = origWarn;
            }
            const elapsed = Date.now() - startTime;
            this._emitEvent('lm:model-load-complete', { modelName: this.modelName, task: this.task, elapsedMs: elapsed });
            this._emitDebug('Model loaded successfully', {modelName: this.modelName, elapsedMs: elapsed});
        } catch (error) {
            if (error.message.includes('timed out')) {
                this._emitEvent('lm:model-load-timeout', { modelName: this.modelName, task: this.task, timeoutMs: this.loadTimeout, elapsedMs: Date.now() - startTime });
            }
            this.pipeline = null;
            throw error;
        }
    }

    async generateText(prompt, options = {}) {
        await this._initialize();
        const {maxTokens, temperature} = options;
        const temp = temperature ?? this.temperature ?? 0.7;
        const inputText = Array.isArray(prompt) ? this._formatChatPrompt(prompt) : String(prompt);
        try {
            const generateOptions = { max_new_tokens: maxTokens ?? this.maxTokens ?? 256, do_sample: temp > 0 };
            if (temp > 0) {generateOptions.temperature = temp;}
            const output = await withTimeout(this.pipeline(inputText, generateOptions), this.loadTimeout, 'Inference');
            let text = Array.isArray(output) ? (output[0]?.generated_text ?? '') : typeof output === 'object' ? (output.generated_text ?? '') : String(output);
            // Strip prompt prefix (with or without ChatML tokens)
            const stripChatML = (s) => s.replace(/\x3c\x7c\x69\x6d\x5f\x73\x74\x61\x72\x74\x7c\x3e/g, '').replace(/\x3c\x7c\x69\x6d\x5f\x65\x6e\x64\x7c\x3e/g, '');
            const plainInput = stripChatML(inputText);
            if (text.startsWith(inputText)) {text = text.slice(inputText.length);}
            else if (text.startsWith(plainInput)) {text = text.slice(plainInput.length);}
            return text.trim();
        } catch (error) {
            this._emitDebug('Pipeline error', {error: error.message});
            throw error;
        }
    }

    async* streamText(prompt, options = {}) {
        const result = await this.generateText(prompt, options);
        const chunkSize = 8;
        for (let i = 0; i < result.length; i += chunkSize) {
            yield result.slice(i, i + chunkSize);
        }
    }

    async destroy() { this.pipeline = null; }
}
