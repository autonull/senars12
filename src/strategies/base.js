/**
 * Unified Strategy Base
 *
 * All strategy implementations now share a common base with metadata and
 * a single abstract execute method. Concrete strategies implement the
 * execute method for their specific interface.
 */
/** Common base for all strategies — provides metadata and consistent naming. */
export class Strategy {
    metadata;
    constructor(name, description, version) {
        this.metadata = { name, description, version };
    }
    /** Override in subclasses to provide the strategy's name. */
    get name() {
        return this.metadata.name;
    }
}
/**
 * A strategy that can be configured at construction time.
 * Use this for strategies that accept configuration options.
 */
export class ConfigurableStrategy extends Strategy {
    config;
    constructor(name, description, config, version) {
        super(name, description, version);
        this.config = config;
    }
}
