/**
 * Tool Decorator - Auto-registration system for tools
 */
import type { Tool, ToolCapabilities } from './types.js';

export interface ToolMetadata {
  name: string;
  description: string;
  capabilities?: ToolCapabilities;
  dependencies?: string[];
  priority?: number;
}

type ToolConstructor = new (...args: any[]) => Tool;
type ToolFactory = (deps: Record<string, unknown>) => Tool;

const TOOL_REGISTRY = new Map<string, { factory: ToolFactory; metadata: ToolMetadata }>();

export function tool(metadata: ToolMetadata) {
  return <T extends ToolConstructor>(ctor: T): T => {
    const factory = (toolDeps: Record<string, unknown>) => {
      const depArgs = (metadata.dependencies ?? []).map((d) => toolDeps[d]).filter(Boolean);
      return new ctor(...depArgs);
    };
    TOOL_REGISTRY.set(metadata.name, { factory, metadata });
    return ctor;
  };
}

export function discoverTools(deps?: Record<string, unknown>): Tool[] {
  const tools: Tool[] = [];
  for (const [name, { factory }] of TOOL_REGISTRY) {
    try {
      const instance = factory(deps ?? {});
      tools.push(instance);
    } catch (error) {
      console.warn(`Failed to instantiate tool ${name}:`, error);
    }
  }
  return tools;
}

export function getToolMetadata(name: string): ToolMetadata | undefined {
  return TOOL_REGISTRY.get(name)?.metadata;
}

export function getRegisteredToolNames(): string[] {
  return Array.from(TOOL_REGISTRY.keys());
}

export function clearToolRegistry(): void {
  TOOL_REGISTRY.clear();
}
