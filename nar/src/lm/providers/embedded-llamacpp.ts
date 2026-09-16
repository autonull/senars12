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
  LlamaGrammarEvaluationState,
  type LlamaGrammar,
  type LlamaContextSequence,
  type LlamaModel,
  type Llama,
  type Token,
} from 'node-llama-cpp';
import {
  getModel,
  getContext,
  getLlamaInstance,
  createSequence,
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

function buildLlamaPrompt(prompt: LanguageModelV3CallOptions['prompt']): string {
  const systemPrompt = extractSystemPrompt(prompt);
  const userPrompt = extractTextFromPrompt(prompt);
  const user = `<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;
  return systemPrompt
    ? `<|im_start|>system\n${systemPrompt}<|im_end|>\n${user}`
    : `<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;
}

/** Determine max generation tokens for the given task tier. */
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
      return 0.1;
    case 'quality':
      return 0.7;
    default:
      return 0.3;
  }
}

/**
 * Build a grammar for constrained decoding. Prefers the async-context GBNF
 * grammar (from `runWithGrammar`/`grammarScope`); falls back to a JSON-schema
 * grammar when the call carries a `responseFormat`. Returns `undefined` for
 * unconstrained generation.
 */
async function buildGrammar(
  grammar: string | undefined,
  responseFormat: LanguageModelV3CallOptions['responseFormat'] | undefined
): Promise<LlamaGrammar | undefined> {
  const llama = await getLlamaInstance();
  if (grammar) return llama.createGrammar({ grammar });
  if (responseFormat?.type === 'json' && responseFormat.schema) {
    return llama.createGrammarForJsonSchema(responseFormat.schema as never);
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

interface EvaluateParams {
  temperature: number;
  topK: number;
  topP: number;
  maxTokens: number;
}

function samplingParams(
  options: LanguageModelV3CallOptions,
  task: 'quality' | 'fast' | 'structured' | 'compact'
): EvaluateParams {
  return {
    temperature: options.temperature ?? defaultTemperature(task),
    topK: options.topK ?? 40,
    topP: options.topP ?? 0.95,
    maxTokens: options.maxOutputTokens ?? defaultMaxTokens(task),
  };
}

/** Collect generated tokens from a sequence until EOG/max-tokens/abort. */
async function generate(
  sequence: LlamaContextSequence,
  model: LlamaModel,
  promptTokens: Token[],
  grammar: LlamaGrammar | undefined,
  params: EvaluateParams,
  abortSignal: AbortSignal | undefined
): Promise<{ tokens: Token[]; truncated: boolean }> {
  const grammarState = grammar
    ? new LlamaGrammarEvaluationState({ model, grammar })
    : undefined;
  const generated: Token[] = [];
  let truncated = false;
  for await (const token of sequence.evaluate(promptTokens, {
    temperature: params.temperature,
    topK: params.topK,
    topP: params.topP,
    grammarEvaluationState: grammarState,
  })) {
    if (abortSignal?.aborted) {
      truncated = true;
      break;
    }
    if (model.isEogToken(token)) break;
    generated.push(token);
    if (generated.length >= params.maxTokens) {
      truncated = true;
      break;
    }
  }
  return { tokens: generated, truncated };
}

const finishReason = (truncated: boolean): LanguageModelV3GenerateResult['finishReason'] =>
  truncated ? { unified: 'length', raw: 'max-tokens' } : { unified: 'stop', raw: 'stop' };

export function createEmbeddedLlamaCppLanguageModel(
  task: 'quality' | 'fast' | 'structured' | 'compact'
): LanguageModel {
  const doGenerate: LanguageModelV3['doGenerate'] = async (
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3GenerateResult> => {
    await ensureRuntimeLoaded();
    const model = await getModel();
    const context = await getContext();
    const sequence = await createSequence();
    const promptText = buildLlamaPrompt(options.prompt);
    const promptTokens = model.tokenize(promptText, true);
    const grammar = await buildGrammar(grammarScope.getStore(), options.responseFormat);
    const params = samplingParams(options, task);

    const { tokens, truncated } = await generate(
      sequence,
      model,
      promptTokens,
      grammar,
      params,
      options.abortSignal
    );
    await sequence.dispose();
    const text = model.detokenize(tokens);

    return {
      content: [{ type: 'text', text }],
      finishReason: finishReason(truncated),
      usage: {
        inputTokens: { total: promptTokens.length, noCache: promptTokens.length, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: tokens.length, text: tokens.length, reasoning: 0 },
      },
      warnings: [],
    };
  };

  const doStream: LanguageModelV3['doStream'] = async (
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3StreamResult> => {
    await ensureRuntimeLoaded();
    const model = await getModel();
    const sequence = await createSequence();
    const promptText = buildLlamaPrompt(options.prompt);
    const promptTokens = model.tokenize(promptText, true);
    const grammar = await buildGrammar(grammarScope.getStore(), options.responseFormat);
    const params = samplingParams(options, task);
    const grammarState = grammar
      ? new LlamaGrammarEvaluationState({ model, grammar })
      : undefined;

    const chunks: LanguageModelV3StreamPart[] = [{ type: 'text-start', id: '0' }];
    let outputTokens = 0;
    let truncated = false;
    for await (const token of sequence.evaluate(promptTokens, {
      temperature: params.temperature,
      topK: params.topK,
      topP: params.topP,
      grammarEvaluationState: grammarState,
    })) {
      if (options.abortSignal?.aborted) {
        truncated = true;
        break;
      }
      if (model.isEogToken(token)) break;
      chunks.push({ type: 'text-delta', id: '0', delta: model.detokenize([token], false, []) });
      outputTokens++;
      if (outputTokens >= params.maxTokens) {
        truncated = true;
        break;
      }
    }
    await sequence.dispose();
    chunks.push({ type: 'text-end', id: '0' });
    chunks.push({
      type: 'finish',
      finishReason: finishReason(truncated),
      usage: {
        inputTokens: { total: promptTokens.length, noCache: promptTokens.length, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
      },
    });

    return { stream: simulateReadableStream({ chunks }) };
  };

  return new MockLanguageModelV3({
    provider: 'llamacpp-embedded',
    modelId: `llamacpp-embedded:${task}`,
    doGenerate,
    doStream,
  }) as unknown as LanguageModel;
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