/**
 * Facade barrel — implementation lives in sibling modules.
 * Export surface is unchanged from the pre-M5 monolith.
 */
export { CoreToolRegistryAdapter } from './core-adapter.js';
export { executeToolGoal, type ToolExecutor } from './goal.js';
export { ToolManager } from './manager.js';
export { Registry, type ToolDescriptor } from './registry.js';
