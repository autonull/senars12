import { type LMSettings } from '../env-config';
import { type LMProviderName, type ProviderRuntime } from '../provider-runtime';
/** Probe an OpenAI-compatible endpoint (/models); auth header sent only when a key is available. */
export declare function probeOpenAICompatible(settings?: LMSettings): Promise<boolean>;
export declare function resolveActiveProvider(): Promise<LMProviderName>;
export declare const getCircuitBreaker: import("../provider-runtime").Delegated<"getCircuitBreaker">;
export declare const getAllCircuitBreakers: import("../provider-runtime").Delegated<"getAllCircuitBreakers">;
/** Close all breakers and clear failure counts (test/bench isolation between independent scenarios). */
export declare const resetCircuitBreakers: import("../provider-runtime").Delegated<"resetCircuitBreakers">;
/** Effective circuit breaker config for a provider (settings > provider defaults > global defaults). */
export declare const getEffectiveCircuitConfig: import("../provider-runtime").Delegated<"getEffectiveCircuitConfig">;
export declare const recordProviderCall: import("../provider-runtime").Delegated<"recordProviderCall">;
export declare const canUseProvider: import("../provider-runtime").Delegated<"canUseProvider">;
export declare function probeCloudProvider(settings?: LMSettings): Promise<boolean>;
export declare function startHealthProbes(intervalMs?: number, settings?: LMSettings, rt?: ProviderRuntime): void;
export declare function stopHealthProbes(rt?: ProviderRuntime): void;
//# sourceMappingURL=health.d.ts.map