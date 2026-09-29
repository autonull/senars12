/**
 * Facade barrel — implementation lives in sibling modules.
 * Export surface is unchanged from the pre-M5 monolith.
 */
export { CoreToolRegistryAdapter } from './CoreToolRegistryAdapter.js';
export { executeToolGoal, type ToolExecutor } from './goal.js';
export { ToolManager } from './ToolManager.js';
export { Registry, type ToolDescriptor } from './Registry.js';
