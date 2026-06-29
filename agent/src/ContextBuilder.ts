import type {DriveManager} from '../../nar/src/drives';
import {createLogger, type Logger} from '../../nar/src/logger';
import type {Episode, TemporalEmbeddingMemory,} from '../../nar/src/memory/TemporalEmbeddingMemory.js';

export interface ContextSection {
    name: string;

    isRelevant(context: ContextData): Promise<boolean>;

    render(context: ContextData): Promise<string>;
}

export interface ContextData {
    drives: DriveState[];
    memories: Episode[];
    history: string;
    pendingActions: ToolCall[];
    systemState: SystemState;
}

export interface DriveState {
    name: string;
    intensity: number;
    description: string;
    isActive: boolean;
}

export interface ToolCall {
    tool: string;
    parameters: Record<string, unknown>;
    id: string;
}

export interface SystemState {
    narState: string;
    autonomyRunning: boolean;
    memoryStats: { size: number; capacity: number };
    timestamp: number;
}

export class ContextBuilder {
    private readonly sections: ContextSection[] = [];
    private readonly logger: Logger;

    constructor(logger?: Logger) {
        this.logger = logger ?? createLogger({scope: 'context-builder'});
    }

    addSection(section: ContextSection): this {
        this.sections.push(section);
        return this;
    }

    async build(context: ContextData): Promise<string> {
        const parts: string[] = [];

        for (const section of this.sections) {
            if (await section.isRelevant(context)) {
                const content = await section.render(context);
                if (content) {
                    parts.push(`## ${section.name}\n${content}`);
                }
            }
        }

        return parts.join('\n\n');
    }
}

export class DriveSection implements ContextSection {
    name = 'Current Drives';

    constructor(private readonly driveManager: DriveManager) {
    }

    async isRelevant(): Promise<boolean> {
        return true;
    }

    async render(context: ContextData): Promise<string> {
        return context.drives
            .filter((d) => d.intensity > 0.3)
            .map((d) => `- ${d.name}: ${d.intensity.toFixed(2)} (${d.description})`)
            .join('\n');
    }
}

export class MemorySection implements ContextSection {
    name = 'Relevant Memories';

    constructor(private readonly memory: TemporalEmbeddingMemory) {
    }

    async isRelevant(context: ContextData): Promise<boolean> {
        return context.memories.length > 0;
    }

    async render(context: ContextData): Promise<string> {
        return context.memories
            .map((m) => `- ${m.text} (relevance: ${m.relevance?.toFixed(2) ?? 'N/A'})`)
            .join('\n');
    }
}

export class ToolResultsSection implements ContextSection {
    name = 'Recent Tool Results';

    async isRelevant(context: ContextData): Promise<boolean> {
        return context.pendingActions.length > 0;
    }

    async render(context: ContextData): Promise<string> {
        return context.pendingActions
            .slice(-5)
            .map((a) => `### ${a.tool}\n${JSON.stringify(a.parameters)}`)
            .join('\n\n');
    }
}

export class HistorySection implements ContextSection {
    name = 'Conversation History';

    async isRelevant(context: ContextData): Promise<boolean> {
        return context.history.length > 0;
    }

    async render(context: ContextData): Promise<string> {
        return context.history;
    }
}

export class PendingActionsSection implements ContextSection {
    name = 'Pending Actions';

    async isRelevant(context: ContextData): Promise<boolean> {
        return context.pendingActions.length > 0;
    }

    async render(context: ContextData): Promise<string> {
        return context.pendingActions
            .map((a) => `- ${a.tool}(${JSON.stringify(a.parameters)})`)
            .join('\n');
    }
}

export class SystemStateSection implements ContextSection {
    name = 'System State';

    async isRelevant(): Promise<boolean> {
        return true;
    }

    async render(context: ContextData): Promise<string> {
        const state = context.systemState;
        return [
            `- NAR State: ${state.narState}`,
            `- Autonomy Running: ${state.autonomyRunning}`,
            `- Memory: ${state.memoryStats.size}/${state.memoryStats.capacity}`,
        ].join('\n');
    }
}

export function createDefaultContextBuilder(
    driveManager: DriveManager,
    memory: TemporalEmbeddingMemory,
    logger?: Logger
): ContextBuilder {
    return new ContextBuilder(logger)
        .addSection(new DriveSection(driveManager))
        .addSection(new MemorySection(memory))
        .addSection(new ToolResultsSection())
        .addSection(new HistorySection())
        .addSection(new PendingActionsSection())
        .addSection(new SystemStateSection());
}
