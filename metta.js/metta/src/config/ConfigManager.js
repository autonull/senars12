/**
 * @deprecated Import ConfigManager, Validators, createConfigManager from '@senars/core' instead.
 * Re-exports for backward compatibility with MeTTa-specific config helper.
 */
export {ConfigManager, Validators, createConfigManager} from '@senars/core';

import {configManager} from './config.js';

export function createMeTTaConfig(overrides = {}) {
    const config = configManager.getAll();
    return {...config, ...overrides};
}
