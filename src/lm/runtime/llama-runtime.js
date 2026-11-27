import { getLlama, resolveChatWrapper, } from 'node-llama-cpp';
import { SenarsError } from '../../errors/senars-error';
let llamaP;
let modelP;
let contextP;
let embeddingContextP;
let wrapper;
let currentConfig;
/** GPU backends the embedded llama.cpp build can be asked for. */
export const GPU_BACKENDS = ['cuda', 'metal', 'vulkan'];
const GPU_SETTINGS = new Set(['auto', ...GPU_BACKENDS]);
/** Whether a native capability probe named a backend this runtime implements. */
export const isGpuBackend = (value) => typeof value === 'string' && GPU_BACKENDS.includes(value);
/**
 * The setting from its environment text, or `undefined` when it is unset or says
 * something the runtime does not implement. The union was written out four times
 * and the env read cast into it, which also cast the text `false` to the CPU
 * request it means — `LM_LLAMACPP_GPU=false` reached the loader as a string, and
 * `LM_LLAMACPP_GPU=cuad` was accepted as a request for a backend that does not
 * exist. An unrecognised value now falls through to the file or the default like
 * any other absent one.
 */
export const gpuSettingFrom = (value) => {
    if (value === 'false')
        return false;
    return value !== undefined && GPU_SETTINGS.has(value) ? value : undefined;
};
export async function loadModel(config) {
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
export function getChatWrapper() {
    return wrapper;
}
export function getModel() {
    if (!modelP)
        throw new SenarsError('Embedded llama.cpp model not loaded. Call loadModel first.', 'OPERATION_ERROR');
    return modelP;
}
export function getContext() {
    if (!contextP)
        throw new SenarsError('Embedded llama.cpp context not loaded. Call loadModel first.', 'OPERATION_ERROR');
    return contextP;
}
export function getLlamaInstance() {
    if (!llamaP)
        throw new SenarsError('Embedded llama.cpp runtime not initialized. Call loadModel first.', 'OPERATION_ERROR');
    return llamaP;
}
/**
 * The embedding context over the loaded model: the real, offline vector source
 * the System One encoder reads (CORE.19). One context, shared — `getEmbeddingFor`
 * evaluates against the same model the chat path holds, so a deployment loads a
 * GGUF once. The vector width is the model's own; consumers adapt rather than
 * assume a dimension.
 */
export async function getEmbeddingContext() {
    const model = await getModel();
    embeddingContextP ??= model.createEmbeddingContext();
    return embeddingContextP;
}
export async function createSequence() {
    const context = await getContext();
    if (context.sequencesLeft === 0) {
        throw new SenarsError('Embedded llama.cpp context has no free sequences available.', 'OPERATION_ERROR');
    }
    return context.getSequence();
}
export function getConfig() {
    return currentConfig;
}
export function isLoaded() {
    return Boolean(modelP && contextP);
}
export async function dispose() {
    const embeddingContext = await embeddingContextP?.catch(() => undefined);
    embeddingContextP = undefined;
    await embeddingContext?.dispose().catch(() => undefined);
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
