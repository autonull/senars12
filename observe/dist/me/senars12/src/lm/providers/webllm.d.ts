/** UI layer installs the WebLLM runtime at startup (browser only). */
export declare const configureWebLLM: import("../provider-runtime").Delegated<"configureWebLLM">;
export declare const getWebLLMRuntime: import("../provider-runtime").Delegated<"getWebLLMRuntime">;
/** WebGPU auto-detection: prefer webgpu when available, else cpu. */
export declare const detectDevice: () => 'webgpu' | 'cpu';
//# sourceMappingURL=webllm.d.ts.map