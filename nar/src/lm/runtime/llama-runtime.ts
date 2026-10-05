import {
  type ChatWrapper,
  getLlama,
  type Llama,
  type LlamaContext,
  type LlamaModel,
  resolveChatWrapper,
} from 'node-llama-cpp';

let llamaP: Promise<Llama> | undefined;
let modelP: Promise<LlamaModel> | undefined;
let contextP: Promise<LlamaContext> | undefined;
let wrapper: ChatWrapper | undefined;
let currentConfig: EmbeddedLlamaConfig | undefined;

/** GPU backends the embedded llama.cpp build can be asked for. */
export const GPU_BACKENDS = ['cuda', 'metal', 'vulkan'] as const;

export type GpuBackend = (typeof GPU_BACKENDS)[number];

/** What the GPU setting may say: a named backend, `auto`, or `false` for CPU. */
export type GpuSetting = 'auto' | GpuBackend | false;

const GPU_SETTINGS: ReadonlySet<string> = new Set(['auto', ...GPU_BACKENDS]);

/** Whether a native capability probe named a backend this runtime implements. */
export const isGpuBackend = (value: unknown): value is GpuBackend =>
  typeof value === 'string' && (GPU_BACKENDS as readonly string[]).includes(value);

/**
 * The setting from its environment text, or `undefined` when it is unset or says
 * something the runtime does not implement. The union was written out four times
 * and the env read cast into it, which also cast the text `false` to the CPU
 * request it means — `LM_LLAMACPP_GPU=false` reached the loader as a string, and
 * `LM_LLAMACPP_GPU=cuad` was accepted as a request for a backend that does not
 * exist. An unrecognised value now falls through to the file or the default like
 * any other absent one.
 */
export const gpuSettingFrom = (value: string | undefined): GpuSetting | undefined => {
  if (value === 'false') return false;
  return value !== undefined && GPU_SETTINGS.has(value) ? (value as GpuSetting) : undefined;
};

export interface EmbeddedLlamaConfig {
  modelPath: string;
  gpu?: GpuSetting;
  gpuLayers?: number | 'max';
  contextSize?: number;
  batchSize?: number;
  sequences?: number;
  flashAttention?: boolean;
}

export async function loadModel(config: EmbeddedLlamaConfig): Promise<{
  llama: Llama;
  model: LlamaModel;
  context: LlamaContext;
}> {
  // Dispose any previously resident model/context before swapping.
  await dispose();
  currentConfig = config;
  const llama = await getLlama({ gpu: config.gpu ?? 'auto' });

  const model = await llama.loadModel({
    modelPath: config.modelPath,
    gpuLayers: config.gpuLayers ?? 'max',
  });

  const context = await model.createContext({
    contextSize: config.contextSize ?? 4096,
    batchSize: config.batchSize ?? 512,
    sequences: config.sequences ?? 4,
    flashAttention: config.flashAttention ?? true,
  });

  llamaP = Promise.resolve(llama);
  modelP = Promise.resolve(model);
  contextP = Promise.resolve(context);
  wrapper = resolveChatWrapper(model) ?? wrapper;

  return { llama, model, context };
}

/** Chat wrapper resolved from the GGUF's trained template (undefined until loaded). */
export function getChatWrapper(): ChatWrapper | undefined {
  return wrapper;
}

export function getModel(): Promise<LlamaModel> {
  if (!modelP) throw new Error('Embedded llama.cpp model not loaded. Call loadModel first.');
  return modelP;
}

export function getContext(): Promise<LlamaContext> {
  if (!contextP) throw new Error('Embedded llama.cpp context not loaded. Call loadModel first.');
  return contextP;
}

export function getLlamaInstance(): Promise<Llama> {
  if (!llamaP) throw new Error('Embedded llama.cpp runtime not initialized. Call loadModel first.');
  return llamaP;
}

export async function createSequence(): Promise<Awaited<ReturnType<LlamaContext['getSequence']>>> {
  const context = await getContext();
  if (context.sequencesLeft === 0) {
    throw new Error('Embedded llama.cpp context has no free sequences available.');
  }
  return context.getSequence();
}

export function getConfig(): EmbeddedLlamaConfig | undefined {
  return currentConfig;
}

export function isLoaded(): boolean {
  return Boolean(modelP && contextP);
}

export async function dispose(): Promise<void> {
  const context = await contextP?.catch(() => undefined);
  contextP = undefined;
  await context?.dispose().catch(() => undefined);
  const model = await modelP?.catch(() => undefined);
  modelP = undefined;
  await model?.dispose().catch(() => undefined);
  const llama = await llamaP?.catch(() => undefined);
  llamaP = undefined;
  await llama?.dispose().catch(() => undefined);
  wrapper = undefined;
  currentConfig = undefined;
}
