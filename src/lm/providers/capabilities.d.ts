/** Per-model capability metadata used by routing decisions. */
export interface ModelCapability {
    contextTokens: number;
    supportsTools: boolean;
    supportsJson: boolean;
    costPerMTok: number;
    latencyClass: 'fast' | 'medium' | 'slow';
    local: boolean;
}
export declare const MODEL_CAPABILITIES: Record<string, ModelCapability>;
export declare const getModelCapability: (id: string) => ModelCapability | undefined;
/**
 * Objective-driven routing override lives on `ProviderRuntime`
 * (see provider-runtime.ts); the module functions below delegate to the
 * process-wide default instance. Pass an explicit runtime for scoped state.
 */
export declare const latencyClassOf: (id: string) => 'fast' | 'medium' | 'slow';
//# sourceMappingURL=capabilities.d.ts.map