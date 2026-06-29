import type { EnhancedMCPAdapter } from './mcp';

export function registerMCPPrompts(adapter: EnhancedMCPAdapter): void {
  adapter.registerCapability({
    name: 'reasoning_chain',
    description: 'Guide for building NAL inference chains',
    inputSchema: {
      type: 'object',
      properties: {
        premise: { type: 'string', description: 'Starting premise' },
        target: { type: 'string', description: 'Target conclusion' },
      },
    } as any,
  });

  adapter.registerCapability({
    name: 'grounded_fact',
    description: 'Template for adding externally verified facts',
    inputSchema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'Fact to add' },
        source: { type: 'string', description: 'Source of the fact' },
        confidence: { type: 'number', description: 'Confidence level' },
      },
    } as any,
  });

  adapter.registerCapability({
    name: 'multi_cycle_task',
    description: 'Template for multi-turn reasoning tasks',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description' },
        maxCycles: { type: 'number', description: 'Maximum reasoning cycles' },
      },
    } as any,
  });

  adapter.registerCapability({
    name: 'experiment_design',
    description: 'Template for designing parameter sweeps',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Experiment type' },
        parameters: { type: 'object', description: 'Parameter ranges' },
      },
    } as any,
  });

  adapter.registerCapability({
    name: 'benchmark_analysis',
    description: 'Template for analyzing benchmark results',
    inputSchema: {
      type: 'object',
      properties: {
        suite: { type: 'string', description: 'Benchmark suite ID' },
        compareWith: { type: 'string', description: 'Previous run ID to compare' },
      },
    } as any,
  });
}
