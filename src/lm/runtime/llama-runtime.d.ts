import { type ChatWrapper, type Llama, type LlamaContext, type LlamaEmbeddingContext, type LlamaModel } from 'node-llama-cpp';
/** GPU backends the embedded llama.cpp build can be asked for. */
export declare const GPU_BACKENDS: readonly ['cuda', 'metal', 'vulkan'];
export type GpuBackend = (typeof GPU_BACKENDS)[number];
/** What the GPU setting may say: a named backend, `auto`, or `false` for CPU. */
export type GpuSetting = 'auto' | GpuBackend | false;
/** Whether a native capability probe named a backend this runtime implements. */
export declare const isGpuBackend: (value: unknown) => value is GpuBackend;
/**
 * The setting from its environment text, or `undefined` when it is unset or says
 * something the runtime does not implement. The union was written out four times
 * and the env read cast into it, which also cast the text `false` to the CPU
 * request it means — `LM_LLAMACPP_GPU=false` reached the loader as a string, and
 * `LM_LLAMACPP_GPU=cuad` was accepted as a request for a backend that does not
 * exist. An unrecognised value now falls through to the file or the default like
 * any other absent one.
 */
export declare const gpuSettingFrom: (value: string | undefined) => GpuSetting | undefined;
export interface EmbeddedLlamaConfig {
    modelPath: string;
    gpu?: GpuSetting;
    gpuLayers?: number | 'max';
    contextSize?: number;
    batchSize?: number;
    sequences?: number;
    flashAttention?: boolean;
}
export declare function loadModel(config: EmbeddedLlamaConfig): Promise<{
    llama: Llama;
    model: LlamaModel;
    context: LlamaContext;
}>;
/** Chat wrapper resolved from the GGUF's trained template (undefined until loaded). */
export declare function getChatWrapper(): ChatWrapper | undefined;
export declare function getModel(): Promise<LlamaModel>;
export declare function getContext(): Promise<LlamaContext>;
export declare function getLlamaInstance(): Promise<Llama>;
/**
 * The embedding context over the loaded model: the real, offline vector source
 * the System One encoder reads (CORE.19). One context, shared — `getEmbeddingFor`
 * evaluates against the same model the chat path holds, so a deployment loads a
 * GGUF once. The vector width is the model's own; consumers adapt rather than
 * assume a dimension.
 */
export declare function getEmbeddingContext(): Promise<LlamaEmbeddingContext>;
export declare function createSequence(): Promise<Awaited<ReturnType<LlamaContext['getSequence']>>>;
export declare function getConfig(): EmbeddedLlamaConfig | undefined;
export declare function isLoaded(): boolean;
export declare function dispose(): Promise<void>;
//# sourceMappingURL=llama-runtime.d.ts.map