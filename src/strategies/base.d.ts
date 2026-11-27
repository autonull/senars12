/**
 * Unified Strategy Base
 *
 * All strategy implementations now share a common base with metadata and
 * a single abstract execute method. Concrete strategies implement the
 * execute method for their specific interface.
 */
import type { ComponentMetadata, WithMetadata } from './types';
/** Common base for all strategies — provides metadata and consistent naming. */
export declare abstract class Strategy implements WithMetadata {
    readonly metadata: ComponentMetadata;
    constructor(name: string, description: string, version?: string);
    /** Override in subclasses to provide the strategy's name. */
    get name(): string;
}
/**
 * A strategy that can be configured at construction time.
 * Use this for strategies that accept configuration options.
 */
export declare abstract class ConfigurableStrategy<Config> extends Strategy {
    readonly config: Readonly<Config>;
    constructor(name: string, description: string, config: Config, version?: string);
}
/**
 * Marker interface for stateless strategies (no config, no instance state).
 * These can be safely singletoned.
 */
export interface StatelessStrategy extends Strategy {
}
/**
 * Marker interface for stateful strategies (hold state across calls).
 * These should NOT be singletoned — each resolution gets a fresh instance.
 */
export interface StatefulStrategy extends Strategy {
}
//# sourceMappingURL=base.d.ts.map