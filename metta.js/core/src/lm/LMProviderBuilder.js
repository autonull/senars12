import {LMConfig} from './LMConfig.js';

/**
 * @deprecated Use LMConfig.createActiveProvider() and LMConfig.bindTools() instead
 *
 * LMProviderBuilder is deprecated as of Phase 4. Provider creation is now
 * handled by LMConfig, and tool binding is available as a static method.
 *
 * Migration:
 *   const provider = LMProviderBuilder.create(agent, lmConfig);
 *
 * Becomes:
 *   const config = new LMConfig();
 *   config.setProvider('ollama', lmConfig);
 *   config.setActive('ollama');
 *   const provider = config.createActiveProvider();
 *   LMConfig.bindTools(provider, agent);
 */
export class LMProviderBuilder {
    static create(agent, lmConfigData) {
        console.warn('[DEPRECATED] LMProviderBuilder is deprecated. Use LMConfig.createActiveProvider() and LMConfig.bindTools() instead.');

        const config = new LMConfig();
        const providerType = lmConfigData.provider || 'ollama';

        config.setProvider(providerType, {
            ...lmConfigData,
            type: providerType
        });
        config.setActive(providerType);

        const provider = config.createActiveProvider();
        LMConfig.bindTools(provider, agent);

        return provider;
    }
}
