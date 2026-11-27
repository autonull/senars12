import { existsSync } from 'node:fs';
import { envBool, envStr } from '@senars/config';
import { errMsg } from '@senars/util/error';
import { extractLastUserMessage } from '@senars/util/prompt';
import { SerialQueue } from '@senars/util/async';
import { mapValues } from '@senars/util/collections';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import { GeneralChatWrapper, getLlama, getLlamaGpuTypes, LlamaChatSession, } from 'node-llama-cpp';
import { createSequence, getChatWrapper, getContext, getLlamaInstance, isGpuBackend, isLoaded, } from '../runtime/llama-runtime';
import { grammarScope } from './llamacpp';
import { getLMSettings } from './settings';
import { SenarsError } from '../../errors/senars-error';
import { createLogger } from '../../util/logger';
const logger = createLogger({ scope: 'lm:providers:embedded-llamacpp' });
function extractSystemPrompt(prompt) {
    if (!prompt || prompt.length === 0)
        return undefined;
    const system = prompt.find((m) => m.role === 'system');
    if (!system)
        return undefined;
    const c = system.content;
    if (typeof c === 'string')
        return c;
    if (Array.isArray(c))
        return c
            .map((p) => (p.type === 'text' ? p.text : ''))
            .join('');
    return undefined;
}
function defaultMaxTokens(task) {
    switch (task) {
        case 'quality':
            return 2048;
        case 'structured':
            return 1024;
        default:
            return 768;
    }
}
function defaultTemperature(task) {
    switch (task) {
        case 'structured':
            return 0.3;
        case 'quality':
            return 0.7;
        default:
            return 0.3;
    }
}
/** Filter thought/comment reasoning segments from a chat response. */
function visibleText(response) {
    return response
        .map((item) => {
        if (typeof item === 'string')
            return item;
        if (item.type === 'segment') {
            if (item.segmentType === 'thought' || item.segmentType === 'comment')
                return '';
            return item.text;
        }
        return '';
    })
        .join('')
        .trim();
}
/**
 * Force every top-level array to be non-empty. Small models collapse to
 * trivially-valid empty arrays under grammar constraints; the understanding
 * layer treats empty batches as failure, so make them unrepresentable.
 * Junk entries from non-extractive inputs are filtered downstream (firewall).
 */
function withNonEmptyArrays(schema) {
    const props = schema?.properties;
    if (!props)
        return schema;
    const patched = mapValues(props, (v) => (v?.type === 'array' ? { ...v, minItems: 1 } : v));
    return { ...schema, properties: patched };
}
/** Build a JSON-schema or GBNF grammar for the call, if requested. */
async function buildGrammar(options) {
    const llama = await getLlamaInstance();
    const gbnf = grammarScope.getStore();
    if (gbnf)
        return llama.createGrammar({ grammar: gbnf });
    if (options.responseFormat?.type === 'json' && options.responseFormat.schema) {
        try {
            return await llama.createGrammarForJsonSchema(withNonEmptyArrays(options.responseFormat.schema));
        }
        catch {
            return undefined; // schema not grammar-compatible; rely on SDK JSON parsing
        }
    }
    return undefined;
}
/** Load the configured GGUF into the shared runtime if it is not resident yet.
 *  Shared by the chat path and the embedding generator so one deployment loads
 *  one model. */
export async function ensureRuntimeLoaded() {
    if (isLoaded())
        return;
    const settings = getLMSettings();
    const modelPath = settings.llamacppModelPath ?? envStr('LM_LLAMACPP_MODEL');
    if (!modelPath) {
        throw new SenarsError('LM_LLAMACPP_MODEL not set. Run `pnpm exec tsx scripts/fetch-model.ts` first.', 'OPERATION_ERROR');
    }
    const { loadModel } = await import('../runtime/llama-runtime');
    await loadModel({
        modelPath,
        gpu: settings.llamacppGpu,
        gpuLayers: settings.llamacppGpuLayers,
        contextSize: settings.llamacppContextSize,
        batchSize: settings.llamacppBatchSize,
        sequences: settings.llamacppSequences,
        flashAttention: settings.llamacppFlashAttention,
    });
}
/** Calls serialize process-wide: one shared llama context backs all task
 *  model instances — concurrent generations contend for its sequences and
 *  race the native runtime (intermittent SIGSEGV). A single chain also makes
 *  per-call latency honest. */
const callChain = new SerialQueue();
const finishReasonFor = (stop) => stop === 'maxTokens'
    ? { unified: 'length', raw: 'max-tokens' }
    : { unified: 'stop', raw: stop ?? 'stop' };
export function createEmbeddedLlamaCppLanguageModel(task) {
    const runSerial = async (options, onDelta) => {
        await ensureRuntimeLoaded();
        const _context = await getContext();
        const sequence = await createSequence();
        const systemPrompt = extractSystemPrompt(options.prompt);
        // Grammar-constrained output must bypass thinking-model wrappers: their
        // auto-opened thinking segments swallow the entire constrained JSON, so
        // both visibleText and responseText come back empty. A non-segmenting
        // wrapper emits the raw constrained text as-is.
        const grammar = await buildGrammar(options);
        const temperature = options.temperature ?? defaultTemperature(task);
        const maxTokens = options.maxOutputTokens ?? defaultMaxTokens(task);
        let rawChunks = '';
        const session = new LlamaChatSession({
            contextSequence: sequence,
            chatWrapper: grammar ? new GeneralChatWrapper() : (getChatWrapper() ?? 'auto'),
            ...(systemPrompt ? { systemPrompt } : {}),
        });
        let inputTokens = 0;
        let outputTokens = 0;
        let result;
        try {
            result = await session.promptWithMeta(extractLastUserMessage(options.prompt), {
                grammar,
                temperature,
                topK: options.topK ?? 40,
                topP: options.topP ?? 0.95,
                maxTokens,
                signal: options.abortSignal,
                stopOnAbortSignal: true,
                repeatPenalty: { lastTokens: 64, penalty: task === 'structured' ? 1.2 : 1.1 },
                // Cap reasoning so hybrid-thinking models (e.g. Qwen3.5) answer within budget
                // instead of spending every token inside a thinking block.
                ...(grammar ? {} : { budgets: { thoughtTokens: task === 'quality' ? 512 : 128 } }),
                ...(onDelta || grammar
                    ? {
                        onResponseChunk(chunk) {
                            if (!grammar &&
                                chunk.type === 'segment' &&
                                (chunk.segmentType === 'thought' || chunk.segmentType === 'comment'))
                                return;
                            rawChunks += chunk.text;
                            onDelta?.(chunk.text);
                        },
                    }
                    : {}),
            });
        }
        finally {
            inputTokens = sequence.tokenMeter.usedInputTokens;
            outputTokens = sequence.tokenMeter.usedOutputTokens;
            session.dispose({ disposeSequence: true });
        }
        if (envBool('LM_LLAMACPP_DEBUG')) {
            const seg = (i) => typeof i === 'string'
                ? `str(${i.length})`
                : `${i.type}:${'segmentType' in i ? i.segmentType : ''}(${('text' in i ? i.text : '').length})`;
            logger.info('[embedded-llamacpp] grammar', {
                grammar: grammar ? 'active' : 'none',
                stopReason: result.stopReason,
                segments: result.response.map(seg).join(' | '),
            });
        }
        const text = (grammar ? result.responseText || rawChunks : visibleText(result.response) || rawChunks).trim();
        return { text, stopReason: result.stopReason, inputTokens, outputTokens };
    };
    const run = (options, onDelta) => {
        return callChain.run(async () => runSerial(options, onDelta));
    };
    const doGenerate = async (options) => {
        const { text, stopReason, inputTokens, outputTokens } = await run(options);
        return {
            content: [{ type: 'text', text }],
            finishReason: finishReasonFor(stopReason),
            usage: {
                inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
            },
            warnings: [],
        };
    };
    const doStream = async (options) => {
        const chunks = [{ type: 'text-start', id: '0' }];
        const { stopReason, inputTokens, outputTokens } = await run(options, (text) => {
            chunks.push({ type: 'text-delta', id: '0', delta: text });
        });
        chunks.push({ type: 'text-end', id: '0' });
        chunks.push({
            type: 'finish',
            finishReason: finishReasonFor(stopReason),
            usage: {
                inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
            },
        });
        return { stream: simulateReadableStream({ chunks }) };
    };
    const model = new MockLanguageModelV3({
        provider: 'llamacpp-embedded',
        modelId: `llamacpp-embedded:${task}`,
        doGenerate,
        doStream,
    });
    return model;
}
export async function probeEmbeddedLlama() {
    const modelPath = envStr('LM_LLAMACPP_MODEL');
    if (!modelPath)
        return { available: false, detail: 'LM_LLAMACPP_MODEL not set' };
    if (!existsSync(modelPath))
        return { available: false, detail: `Model not found: ${modelPath}` };
    try {
        const gpuTypes = await getLlamaGpuTypes('supported');
        const llama = await getLlama({ gpu: 'auto' });
        await llama.dispose();
        const available = gpuTypes.filter(isGpuBackend);
        return {
            available: true,
            detail: `Model found, GPU backends: ${available.length ? available.join(', ') : 'CPU only'}`,
        };
    }
    catch (e) {
        return { available: false, detail: `Load failed: ${errMsg(e)}` };
    }
}
