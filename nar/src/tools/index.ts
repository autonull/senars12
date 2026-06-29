import { createToolEvent, errorResult } from './types.js';
export { errorResult, createToolEvent };

import { Registry, ToolManager } from './tool-registry.js';
export { Registry, ToolManager };

import { discoverTools } from './decorator.js';
export { discoverTools };

import { ExplainTool } from './ExplainTool.js';
export { ExplainTool };

import { SleepTool } from './SleepTool.js';
export { SleepTool };

import { TimerTool } from './TimerTool.js';
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
