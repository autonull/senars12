import { discoverTools } from './impls/decorator';
import { ExplainTool } from './impls/ExplainTool';
import { SleepTool } from './impls/SleepTool';
import { AgentOptionsSchema, ConnectionConfigSchema, type AgentOptions, type ConnectionConfig } from './schemas';
import {
  FIX_PATTERN_MAPPINGS,
  type FixPatternMapping,
  getFixPatternConcepts,
  getFixPatternMapping,
  initializeSelfConcept,
  SELF_CONCEPT_BELIEFS,
} from './impls/self-concept';
import { CoreToolRegistryAdapter, Registry, ToolManager } from './impls/tool-registry';
import { createToolEvent } from './types';

// Type re-exports for TypeScript consumers
export type {
  Tool,
  ToolBudget,
  ToolCapabilities,
  ToolChainResult,
  ToolChainStep,
  ToolContext,
  ToolEvent,
  ToolFilter,
  ToolFn,
  ToolRegistry,
  ToolResult,
  ToolSchema,
  ToolSchemaProperty,
} from './types';
export {
  CoreToolRegistryAdapter,
  createToolEvent,
  discoverTools,
  ExplainTool,
  FIX_PATTERN_MAPPINGS,
  type FixPatternMapping,
  getFixPatternConcepts,
  getFixPatternMapping,
  initializeSelfConcept,
  Registry,
  SELF_CONCEPT_BELIEFS,
  SleepTool,
  ToolManager,
  AgentOptionsSchema,
  ConnectionConfigSchema,
  type AgentOptions,
  type ConnectionConfig,
};
