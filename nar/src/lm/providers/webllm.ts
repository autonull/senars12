import {
  getProviderRuntime,
  type ProviderRuntime,
  type WebLLMRuntime,
} from '../provider-runtime.js';

/** UI layer installs the WebLLM runtime at startup (browser only). */
export const configureWebLLM = (
  runtime: WebLLMRuntime | undefined,
  rt: ProviderRuntime = getProviderRuntime()
): void => {
  rt.configureWebLLM(runtime);
};
export const getWebLLMRuntime = (rt: ProviderRuntime = getProviderRuntime()) =>
  rt.getWebLLMRuntime();

/** Install file/config-derived settings (env still wins at read time). */

/** WebGPU auto-detection: prefer webgpu when available, else cpu. */
export const detectDevice = (): 'webgpu' | 'cpu' =>
  typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'cpu';

/**
 * TransformersJS parses tool calls from fenced JSON and cannot honor
 * `toolChoice`; the AI SDK resolves an absent choice to `{type:'auto'}`,
 * which trips the provider's unsupported-setting warning on every call.
 * Stripping it keeps tools working (fence parsing) without the noise.
 */
