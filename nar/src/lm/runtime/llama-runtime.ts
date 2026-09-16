import {
  getLlama,
  resolveChatWrapper,
  type ChatWrapper,
  type Llama,
  type LlamaModel,
  type LlamaContext,
} from 'node-llama-cpp';

let llamaP: Promise<Llama> | undefined;
let modelP: Promise<LlamaModel> | undefined;
let contextP: Promise<LlamaContext> | undefined;
let wrapper: ChatWrapper | undefined;
let currentConfig: EmbeddedLlamaConfig | undefined;

export interface EmbeddedLlamaConfig {
  modelPath: string;
  gpu?: 'auto' | 'cuda' | 'metal' | 'vulkan' | false;
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
    sequences: config.sequences ?? 1,
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
  if (contextP) {
    await contextP.catch(() => undefined);
    contextP = undefined;
  }
  if (modelP) {
    await modelP.catch(() => undefined);
    modelP = undefined;
  }
  if (llamaP) {
    await llamaP.catch(() => undefined);
    llamaP = undefined;
  }
  wrapper = undefined;
  currentConfig = undefined;
}