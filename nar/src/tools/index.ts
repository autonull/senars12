import { discoverTools } from './decorator.js';
import { ExplainTool } from './ExplainTool.js';
import { SleepTool } from './SleepTool.js';
import { TimerTool } from './TimerTool.js';
import { Registry, ToolManager } from './tool-registry.js';
import { createToolEvent, errorResult } from './types.js';
import { initializeSelfConcept, SELF_CONCEPT_BELIEFS, FIX_PATTERN_MAPPINGS, getFixPatternMapping, getFixPatternConcepts, type FixPatternMapping } from './self-concept.js';

// Type re-exports for TypeScript consumers
export type {
  Schema,
  SchemaProperty,
  Tool,
  ToolBudget,
  ToolCapabilities,
  ToolChainResult,
  ToolChainStep,
  ToolContext,
  ToolEvent,
  ToolFilter,
  ToolRegistry,
  ToolResult,
  ToolStatistics,
} from './types.js';
export {
  createToolEvent,
  discoverTools,
  ExplainTool,
  errorResult,
  Registry,
  SleepTool,
  TimerTool,
  ToolManager,
  initializeSelfConcept,
  SELF_CONCEPT_BELIEFS,
  FIX_PATTERN_MAPPINGS,
  getFixPatternMapping,
  getFixPatternConcepts,
  type FixPatternMapping,
};
