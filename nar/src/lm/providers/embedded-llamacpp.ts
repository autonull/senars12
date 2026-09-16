import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import { simulateReadableStream, MockLanguageModelV3 } from 'ai/test';
import type { LanguageModel } from 'ai';
import {
  LlamaChatSession,
  type ChatModelResponse,
  type LlamaChatResponseChunk,
  type LlamaGrammar,
  type Llama,
} from 'node-llama-cpp';
import {
  getModel,
  getContext,
  getLlamaInstance,
  createSequence,
  getChatWrapper,
  isLoaded,
} from '../runtime/llama-runtime.js';
import { getLMSettings } from '../providers.js';
import { grammarScope } from './llamacpp.js';
import { existsSync } from 'node:fs';
import { getLlama, getLlamaGpuTypes } from 'node-llama-cpp';

function extractTextFromPrompt(prompt: LanguageModelV3CallOptions['prompt']): string {
  if (!prompt || prompt.length === 0) return '';
  const lastUser = [...prompt].reverse().find((m) => m.role === 'user');
  if (!lastUser) return '';
  const c = lastUser.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c))
    return c
      .map((p: { type?: string; text?: string }) => (p.type === 'text' ? p.text : ''))
      .join('');
  return '';
}

function extractSystemPrompt(prompt: LanguageModelV3CallOptions['prompt']): string | undefined {
  if (!prompt || prompt.length === 0) return undefined;
  const system = prompt.find((m) => m.role === 'system');
  if (!system) return undefined;
  const c = system.content as unknown;
  if (typeof c === 'string') return c;
  if (Array.isArray(c))
    return (c as Array<{ type?: string; text?: string }>)
      .map((p) => (p.type === 'text' ? p.text : ''))
      .join('');
  return undefined;
}

function defaultMaxTokens(task: 'quality' | 'fast' | 'structured' | 'compact'): number {
  switch (task) {
    case 'quality':
      return 2048;
    case 'structured':
      return 1024;
    default:
      return 768;
  }
}

function defaultTemperature(task: 'quality' | 'fast' | 'structured' | 'compact'): number {
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
function visibleText(response: ChatModelResponse['response']): string {
  return response
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item.type === 'segment') {
        if (item.segmentType === 'thought' || item.segmentType === 'comment') return '';
        return item.text;
      }
      return '';
    })
    .join('')
    .trim();
}

/** Build a JSON-schema or GBNF grammar for the call, if requested. */
async function buildGrammar(
  options: LanguageModelV3CallOptions
): Promise<LlamaGrammar | undefined> {
  const llama = await getLlamaInstance();
  const gbnf = grammarScope.getStore();
  if (gbnf) return llama.createGrammar({ grammar: gbnf });
  if (options.responseFormat?.type === 'json' && options.responseFormat.schema) {
    try {
      return await llama.createGrammarForJsonSchema(options.responseFormat.schema as never);
    } catch {
      return undefined; // schema not grammar-compatible; rely on SDK JSON parsing
    }
  }
  return undefined;
}

async function ensureRuntimeLoaded(): Promise<void> {
  if (isLoaded()) return;
  const settings = getLMSettings();
  const modelPath = settings.llamacppModelPath ?? process.env.LM_LLAMACPP_MODEL;
  if (!modelPath) {
    throw new Error('LM_LLAMACPP_MODEL not set. Run `pnpm exec tsx scripts/fetch-model.ts` first.');
  }
  const { loadModel } = await import('../runtime/llama-runtime.js');
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

const finishReasonFor = (
  stop: 'customStopTrigger' | 'abort' | 'maxTokens' | 'eogToken' | 'stopGenerationTrigger' | 'functionCalls' | undefined
): LanguageModelV3GenerateResult['finishReason'] =>
  stop === 'maxTokens'
    ? { unified: 'length', raw: 'max-tokens' }
    : { unified: 'stop', raw: stop ?? 'stop' };

export function createEmbeddedLlamaCppLanguageModel(
  task: 'quality' | 'fast' | 'structured' | 'compact'
): LanguageModel {
  const run = async (
    options: LanguageModelV3CallOptions,
    onDelta?: (text: string) => void
  ): Promise<{
    text: string;
    stopReason: Parameters<typeof finishReasonFor>[0];
    inputTokens: number;
    outputTokens: number;
  }> => {
    await ensureRuntimeLoaded();
    const context = await getContext();
    const sequence = await createSequence();
    const systemPrompt = extractSystemPrompt(options.prompt);
    const session = new LlamaChatSession({
      contextSequence: sequence,
      chatWrapper: getChatWrapper() ?? 'auto',
      ...(systemPrompt ? { systemPrompt } : {}),
    });

    const grammar = await buildGrammar(options);
    const temperature = options.temperature ?? defaultTemperature(task);
    const maxTokens = options.maxOutputTokens ?? defaultMaxTokens(task);

    const result = await session.promptWithMeta(extractTextFromPrompt(options.prompt), {
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
      budgets: { thoughtTokens: task === 'quality' ? 512 : 128 },
      ...(onDelta
        ? {
            onResponseChunk(chunk: LlamaChatResponseChunk) {
              if (chunk.type === 'segment' && (chunk.segmentType === 'thought' || chunk.segmentType === 'comment')) return;
              onDelta(chunk.text);
            },
          }
        : {}),
    });

    const inputTokens = sequence.tokenMeter.usedInputTokens;
    const outputTokens = sequence.tokenMeter.usedOutputTokens;
    session.dispose({ disposeSequence: true });
    if (process.env.LM_LLAMACPP_DEBUG) {
      const seg = (i: ChatModelResponse['response'][number]) =>
        typeof i === 'string' ? `str(${i.length})` : `${i.type}:${'segmentType' in i ? i.segmentType : ''}(${('text' in i ? i.text : '').length})`;
      console.error('[embedded-llamacpp] grammar:', grammar ? 'active' : 'none',
        '| stopReason:', result.stopReason,
        '| segments:', result.response.map(seg).join(' | '));
    }
    // Grammar output is JSON by construction; segment misclassification
    // (thinking-model wrappers tag constrained output as thought) must not strip it.
    const text = grammar ? result.responseText.trim() : visibleText(result.response);
    return { text, stopReason: result.stopReason, inputTokens, outputTokens };
  };

  const doGenerate: LanguageModelV3['doGenerate'] = async (
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3GenerateResult> => {
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

  const doStream: LanguageModelV3['doStream'] = async (
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3StreamResult> => {
    const chunks: LanguageModelV3StreamPart[] = [{ type: 'text-start', id: '0' }];
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
  }) as unknown as LanguageModel;
  return model;
}

export async function probeEmbeddedLlama(): Promise<{ available: boolean; detail: string }> {
  const modelPath = process.env.LM_LLAMACPP_MODEL;
  if (!modelPath) return { available: false, detail: 'LM_LLAMACPP_MODEL not set' };
  if (!existsSync(modelPath)) return { available: false, detail: `Model not found: ${modelPath}` };
  try {
    const gpuTypes = await getLlamaGpuTypes('supported');
    const llama: Llama = await getLlama({ gpu: 'auto' });
    await llama.dispose();
    const available = gpuTypes.filter((t) => t === 'cuda' || t === 'metal' || t === 'vulkan');
    return {
      available: true,
      detail: `Model found, GPU backends: ${available.length ? available.join(', ') : 'CPU only'}`,
    };
  } catch (e) {
    return { available: false, detail: `Load failed: ${(e as Error).message}` };
  }
}