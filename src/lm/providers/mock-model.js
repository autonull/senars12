import { extractLastUserMessage } from '@senars/util/prompt';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
const NO_CACHE_TOKENS = { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 };
const textUsage = (text) => ({
    inputTokens: NO_CACHE_TOKENS,
    outputTokens: { total: text.length, text: text.length, reasoning: 0 },
});
const STOP = { unified: 'stop', raw: 'stop' };
/**
 * The single mock `LanguageModelV3` shim: one `doGenerate`/`doStream` pair
 * shared by the mock LM service, the provider factory, and transport stubs.
 */
export function createMockModel({ provider = 'mock', modelId = 'mock', generateTextFn, defaultText = (key) => `Mock response: ${key.slice(0, 50)}`, transformText, } = {}) {
    const respond = async (options) => {
        const key = extractLastUserMessage(options.prompt ?? []);
        const text = generateTextFn ? await generateTextFn(key) : defaultText(key);
        return transformText ? transformText(text, options) : text;
    };
    const doGenerate = async (options) => {
        const text = await respond(options);
        const result = {
            content: [{ type: 'text', text }],
            finishReason: STOP,
            usage: textUsage(text),
            warnings: [],
        };
        return result;
    };
    const doStream = async (options) => {
        const text = await respond(options);
        const chunks = [
            { type: 'text-start', id: '0' },
            { type: 'text-delta', id: '0', delta: text },
            { type: 'text-end', id: '0' },
            { type: 'finish', finishReason: STOP, usage: textUsage(text) },
        ];
        const result = { stream: simulateReadableStream({ chunks }) };
        return result;
    };
    return new MockLanguageModelV3({ provider, modelId, doGenerate, doStream });
}
