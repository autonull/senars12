import { delegate } from '../provider-runtime.js';

/** UI layer installs the WebLLM runtime at startup (browser only). */
export const configureWebLLM = delegate('configureWebLLM');

export const getWebLLMRuntime = delegate('getWebLLMRuntime');

/** WebGPU auto-detection: prefer webgpu when available, else cpu. */
export const detectDevice = (): 'webgpu' | 'cpu' =>
  typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'cpu';
