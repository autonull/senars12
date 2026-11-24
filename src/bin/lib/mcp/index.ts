/**
 * MCP Barrel — Public API for MCP Consolidation
 */

// Core: response helpers + NAR tool bridge
export {
  createMCPResponse,
  formatBeliefsForMCP,
  stringifyMCP,
  jsonContents,
  textContents,
  registerJsonResource,
  ANNOTATIONS,
  MCPStructuredContent,
  zodFromSchema,
  toolAnnotations,
  registerNARRegistryTools,
} from './core';

// Tools: all tool registrations (NAR + Dialogue)
export {
  registerNARTools,
  registerDialogueTools,
  type NARToolsOptions,
  type DialogueToolsOptions,
} from './tools';

// Resources & Prompts
export {
  registerMCPResources,
  registerMCPPrompts,
  type MCPResourceContext,
} from './resources';

// Jobs: fire-and-forget background jobs
export {
  JobManager,
  type JobStatus,
  type JobRecord,
} from './jobs';