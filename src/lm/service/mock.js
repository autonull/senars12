import { createLMStats, recordLMCall, } from '@senars/types/llm';
import { stopwatch } from '@senars/util/async';
import { createMockModel } from '../providers/mock-model';
export function createMockLMService(config = {}) {
    const { generateTextFn, generateObjectFn, available = true, provider = 'mock', model = 'mock', } = config;
    const service = new MockLMServiceImpl(generateTextFn, generateObjectFn, available, provider, model);
    return service;
}
class MockLMServiceImpl {
    _generateTextFn;
    _generateObjectFn;
    _available;
    _provider;
    _model;
    stats = createLMStats();
    constructor(_generateTextFn, _generateObjectFn, _available = true, _provider = 'mock', _model = 'mock') {
        this._generateTextFn = _generateTextFn;
        this._generateObjectFn = _generateObjectFn;
        this._available = _available;
        this._provider = _provider;
        this._model = _model;
    }
    get provider() {
        return this._provider;
    }
    get model() {
        return this._model;
    }
    get available() {
        return this._available;
    }
    getModel(_task) {
        return createMockModel({
            provider: this._provider,
            modelId: this._model,
            generateTextFn: this._generateTextFn,
            defaultText: () => 'Mock response',
        });
    }
    hasModel() {
        return this._available;
    }
    getStats() {
        return { ...this.stats };
    }
    async generateText(prompt) {
        const elapsed = stopwatch();
        try {
            const text = this._generateTextFn ? await this._generateTextFn(prompt) : 'Mock response';
            this.recordCall(true, elapsed(), prompt.length + text.length);
            return text;
        }
        catch (e) {
            this.recordCall(false, elapsed(), prompt.length);
            throw e;
        }
    }
    async generateObject(_prompt, schema) {
        const elapsed = stopwatch();
        try {
            const obj = this._generateObjectFn
                ? await this._generateObjectFn(_prompt, schema)
                : {};
            this.recordCall(true, elapsed(), JSON.stringify(obj).length);
            return obj;
        }
        catch (e) {
            this.recordCall(false, elapsed(), 0);
            throw e;
        }
    }
    async *stream(_prompt) {
        yield '';
    }
    recordCall(success, durationMs, tokens) {
        recordLMCall(this.stats, success, durationMs, tokens);
    }
    getSpend() {
        return {};
    }
}
