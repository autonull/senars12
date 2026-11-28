import { type LMProviderName } from '../provider-runtime';
/** Install file/config-derived settings (env still wins at read time). */
export declare const configureLM: import("../provider-runtime").Delegated<"configureLM">;
/** Active settings, lazily resolved from env (+ anything installed via configureLM). */
export declare const getLMSettings: import("../provider-runtime").Delegated<"getLMSettings">;
/** Select the runtime-active provider (and optional model) — instant, no rebuild. */
export declare const setActiveProvider: import("../provider-runtime").Delegated<"setActiveProvider">;
/** The runtime provider selection, or undefined when env/config decides. */
export declare const getActiveProvider: import("../provider-runtime").Delegated<"getActiveProvider">;
export declare const getLmProvider: () => LMProviderName;
//# sourceMappingURL=settings.d.ts.map