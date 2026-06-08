import type {NAR} from '../../nar/nar.js';

const routeCounts = new Map<string, number>();
const toolCounts = new Map<string, number>();
const MAX_KEYS = 20;

export function recordRoute(kind: string): void {
    routeCounts.set(kind, (routeCounts.get(kind) ?? 0) + 1);
    if (routeCounts.size > MAX_KEYS) routeCounts.delete(routeCounts.keys().next().value!);
}

export function recordTool(name: string): void {
    toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);
    if (toolCounts.size > MAX_KEYS) toolCounts.delete(toolCounts.keys().next().value!);
}

export function getPolicy(): {routingWeights: Record<string, number>; toolSelectionBias: Record<string, number>; updatedAt: number} {
    const routeTotal = Math.max(1, [...routeCounts.values()].reduce((a, b) => a + b, 0));
    const toolTotal = Math.max(1, [...toolCounts.values()].reduce((a, b) => a + b, 0));
    return {
        routingWeights: Object.fromEntries([...routeCounts].map(([k, v]) => [k, v / routeTotal])),
        toolSelectionBias: Object.fromEntries([...toolCounts].map(([k, v]) => [k, v / toolTotal])),
        updatedAt: Date.now(),
    };
}

export function getSystemAnalysis(nar: NAR): {throughput: number; memoryUsage: number; concepts: number} {
    const stats = nar.getStatistics();
    return {throughput: 0, memoryUsage: process.memoryUsage().heapUsed, concepts: stats.totalConcepts};
}
