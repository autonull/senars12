import type {CommandContext, CommandDefinition} from './index.js';
import {box} from '../display.js';

export const SelfCommands: CommandDefinition[] = [
    {
        name: '.self',
        description: 'Show self/metacognition status',
        usage: '.self',
        handler: (ctx) => {
            const self = ctx.getSelf();
            if (!self) {
                ctx.logger.info('Self/Metacognition is not enabled');
                return;
            }

            const isRunning = (self as any).isRunning ?? false;
            const analysis = (self as any).getSystemAnalysis?.();
            const lines = [
                `Running: ${isRunning ? 'Yes' : 'No'}`,
                ...analysis ? [
                    `Cycles: ${String((analysis as {cycleCount?: number}).cycleCount ?? 'N/A')}`,
                    `Strategies: ${String((analysis as {strategies?: unknown[]}).strategies?.length ?? 0)}`
                ] : []
            ];
            ctx.logger.info('\n' + box('Self/Metacognition Status', lines) + '\n');
        }
    },
    {
        name: '.meta',
        description: 'Show meta-analysis report',
        usage: '.meta',
        handler: (ctx) => {
            const self = ctx.getSelf();
            if (!self) {
                ctx.logger.info('Self/Metacognition is not enabled');
                return;
            }

            const analysis = (self as any).getSystemAnalysis?.();
            if (!analysis) {
                ctx.logger.info('No analysis available yet');
                return;
            }

            const analysisData = analysis as {cycleCount?: number; reasoningQuality?: number; strategies?: Array<{name?: string; efficiency?: number}>};
            const lines: string[] = [`Cycle Count: ${String(analysisData.cycleCount ?? 0)}`];

            const reasoningQuality = analysisData.reasoningQuality;
            if (reasoningQuality) {
                lines.push(`Reasoning Quality: ${reasoningQuality.toFixed(2)}`);
            }

            const strategies = analysisData.strategies;
            if (strategies?.length) {
                lines.push('Strategy Performance:');
                for (const s of strategies.slice(0, 3)) {
                    lines.push(` - ${s.name || 'unknown'}: ${s.efficiency?.toFixed(2) ?? 'N/A'}`);
                }
            }

            ctx.logger.info('\n' + box('Meta-Analysis Report', lines) + '\n');
        }
    },
    {
        name: '.optimize',
        description: 'Apply metacognitive optimizations',
        usage: '.optimize',
        handler: (ctx) => {
            const self = ctx.getSelf();
            if (self?.applyOptimizations) {
                self.applyOptimizations();
                ctx.logger.info('✓ Applied metacognitive optimizations');
            } else {
                ctx.logger.info('Self optimization not available');
            }

            const rlfp = ctx.getRLFP();
            if (rlfp?.optimize) {
                rlfp.optimize();
                ctx.logger.info('✓ RLFP policy optimized');
            }
        }
    }
];