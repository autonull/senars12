/**
 * metta/src/config/index.js - Configuration module exports
 */

export { ConfigManager, createMeTTaConfig, Validators } from './ConfigManager.js';
export { configManager, getConfig } from './config.js';
export {
  ExtensionFactory,
  ExtensionRegistry,
  registerMeTTaExtensions,
} from './ExtensionRegistry.js';
