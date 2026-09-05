import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerMCPPrompts(server: McpServer): void {
  server.registerPrompt(
    'reasoning_chain',
    {
      title: 'Reasoning Chain',
      description: 'Guide for building NAL inference chains',
      argsSchema: {
        premise: z.string().describe('Starting premise'),
        target: z.string().describe('Target conclusion'),
      },
    },
    ({ premise, target }) => ({
      description: 'Build a NAL inference chain',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Build a NAL inference chain from premise to target:\nPremise: ${premise}\nTarget: ${target}`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'grounded_fact',
    {
      title: 'Grounded Fact',
      description: 'Template for adding externally verified facts',
      argsSchema: {
        fact: z.string().describe('Fact to add'),
        source: z.string().optional().describe('Source of the fact'),
        confidence: z.string().optional().describe('Confidence level'),
      },
    },
    ({ fact, source, confidence }) => ({
      description: 'Add a grounded fact to NAR',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Add this externally verified fact:\nFact: ${fact}\nSource: ${source ?? 'Not specified'}\nConfidence: ${confidence ?? 'Not specified'}`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'multi_cycle_task',
    {
      title: 'Multi-Cycle Task',
      description: 'Template for multi-turn reasoning tasks',
      argsSchema: {
        task: z.string().describe('Task description'),
        maxCycles: z.string().optional().describe('Maximum reasoning cycles'),
      },
    },
    ({ task, maxCycles }) => ({
      description: 'Execute a multi-cycle reasoning task',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Execute this multi-cycle reasoning task:\nTask: ${task}\nMax cycles: ${maxCycles ?? 'Default'}`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'experiment_design',
    {
      title: 'Experiment Design',
      description: 'Template for designing parameter sweeps',
      argsSchema: {
        type: z.string().describe('Experiment type'),
        parameters: z.string().describe('Parameter ranges'),
      },
    },
    ({ type, parameters }) => ({
      description: 'Design an experiment',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Design an experiment:\nType: ${type}\nParameters: ${parameters}`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'benchmark_analysis',
    {
      title: 'Benchmark Analysis',
      description: 'Template for analyzing benchmark results',
      argsSchema: {
        suite: z.string().describe('Benchmark suite ID'),
        compareWith: z.string().optional().describe('Previous run ID to compare'),
      },
    },
    ({ suite, compareWith }) => ({
      description: 'Analyze benchmark results',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze benchmark results:\nSuite: ${suite}\nCompare with: ${compareWith ?? 'None'}`,
          },
        },
      ],
    })
  );
}