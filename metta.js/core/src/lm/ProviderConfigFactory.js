import {LMConfig} from './LMConfig.js';

/**
 * @deprecated Use LMConfig directly instead
 */
export class ProviderConfigFactory {
    static getPredefinedModels() {
        return LMConfig.DEFAULT_PROVIDERS.huggingface?.presets ?? {};
    }
}