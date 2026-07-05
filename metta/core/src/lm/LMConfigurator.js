import {LMConfig} from './LMConfig.js';

/**
 * @deprecated Use LMConfig directly instead
 *
 * LMConfigurator is deprecated as of Phase 4. Interactive CLI configuration
 * has been removed; use LMConfig.setProvider() / LMConfig.setActive() programmatically.
 */
export class LMConfigurator {
    constructor() {
        console.warn('[DEPRECATED] LMConfigurator is deprecated. Use LMConfig directly.');
        this._config = new LMConfig();
    }

    getConfig() {
        return this._config;
    }
}