import { discoverTools } from './impls/decorator.js';
import { ExplainTool } from './impls/ExplainTool.js';
import { SleepTool } from './impls/SleepTool.js';
import {
  FIX_PATTERN_MAPPINGS,
  type FixPatternMapping,
  getFixPatternConcepts,
  getFixPatternMapping,
  initializeSelfConcept,
  SELF_CONCEPT_BELIEFS,
} from './impls/self-concept.js';
import { TimerTool } from './impls/TimerTool.js';
import { CoreToolRegistryAdapter, Registry, ToolManager } from './impls/tool-registry.js';
import { createToolEvent, errorResult } from './types.js';

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
} from './types.js';
export {
  CoreToolRegistryAdapter,
  createToolEvent,
  discoverTools,
  ExplainTool,
  errorResult,
  FIX_PATTERN_MAPPINGS,
  type FixPatternMapping,
  getFixPatternConcepts,
  getFixPatternMapping,
  initializeSelfConcept,
  Registry,
  SELF_CONCEPT_BELIEFS,
  SleepTool,
  TimerTool,
  ToolManager,
};
