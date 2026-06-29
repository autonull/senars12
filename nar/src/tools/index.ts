import { ExplainTool } from './ExplainTool.js';
import { SleepTool } from './SleepTool.js';
import { TimerTool } from './TimerTool.js';
import { discoverTools } from './decorator.js';
import { Registry, ToolManager } from './tool-registry.js';
import { createToolEvent, errorResult } from './types.js';

export { errorResult, createToolEvent };

export { Registry, ToolManager };

export { discoverTools };

export { ExplainTool };

export { SleepTool };

export { TimerTool };

// Type re-exports for TypeScript consumers
export type {
  Tool,
  ToolCapabilities,
  ToolContext,
  ToolBudget,
  ToolRegistry,
  ToolFilter,
  ToolChainStep,
  ToolChainResult,
  ToolResult,
  Schema,
  SchemaProperty,
  ToolEvent,
  ToolStatistics,
} from './types.js';
