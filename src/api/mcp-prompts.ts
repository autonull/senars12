import type { EnhancedMCPAdapter } from './mcp';
import type { SeNARSMCPServer } from './mcp-server';

export function registerMCPPrompts(adapter: EnhancedMCPAdapter, server?: SeNARSMCPServer): void {
  const prompts = [
    {
      name: 'reasoning_chain',
      description: 'Guide for building NAL inference chains',
      arguments: [
        { name: 'premise', description: 'Starting premise', required: true },
        { name: 'target', description: 'Target conclusion', required: true },
      ],
    },
    {
      name: 'grounded_fact',
      description: 'Template for adding externally verified facts',
      arguments: [
        { name: 'fact', description: 'Fact to add', required: true },
        { name: 'source', description: 'Source of the fact' },
        { name: 'confidence', description: 'Confidence level' },
      ],
    },
    {
      name: 'multi_cycle_task',
      description: 'Template for multi-turn reasoning tasks',
      arguments: [
        { name: 'task', description: 'Task description', required: true },
        { name: 'maxCycles', description: 'Maximum reasoning cycles' },
      ],
    },
    {
      name: 'experiment_design',
      description: 'Template for designing parameter sweeps',
      arguments: [
        { name: 'type', description: 'Experiment type', required: true },
        { name: 'parameters', description: 'Parameter ranges' },
      ],
    },
    {
      name: 'benchmark_analysis',
      description: 'Template for analyzing benchmark results',
      arguments: [
        { name: 'suite', description: 'Benchmark suite ID', required: true },
        { name: 'compareWith', description: 'Previous run ID to compare' },
      ],
    },
  ];

  for (const p of prompts) {
    adapter.registerCapability({
      name: p.name,
      description: p.description,
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          (p.arguments ?? []).map((a) => [a.name, { type: 'string', description: a.description }])
        ),
        required: (p.arguments ?? []).filter((a) => a.required).map((a) => a.name),
      },
    });
    if (server) server.registerPrompt(p);
  }
}
