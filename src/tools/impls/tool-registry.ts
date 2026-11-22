/**
 * Facade barrel — implementation lives in sibling modules.
 * Export surface is unchanged from the pre-M5 monolith.
 */
export { CoreToolRegistryAdapter } from './CoreToolRegistryAdapter';
export { executeToolGoal, type ToolExecutor } from './goal';
export { Registry, type ToolDescriptor } from './Registry';
export { ToolManager } from './ToolManager';
