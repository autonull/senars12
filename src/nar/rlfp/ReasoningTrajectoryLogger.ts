import {EventBus} from '../types';
import {promises as fs} from 'fs';
import {OperationError} from '../types/core.js';

export interface TrajectoryStep {
    timestamp: number;
    type: string;
    data?: unknown;
}

export interface TrajectoryEventMap {
    llm_prompt: { messages: unknown };
    tool_call: { name: string; args: unknown };
    lm_response: { content: unknown };
    lm_failure: { error: string };
}

export class ReasoningTrajectoryLogger {
    private trajectory: TrajectoryStep[] = [];
    private isLogging = false;

    constructor(private eventBus: EventBus) {
        this.setupEventListeners();
    }

    startTrajectory(): void {
        this.trajectory = [];
        this.isLogging = true;
    }

    logStep(type: string, data: unknown): void {
        if (!this.isLogging) return;
        this.trajectory.push({timestamp: Date.now(), type, data});
    }

    async endTrajectory(filePath?: string): Promise<TrajectoryStep[]> {
        this.isLogging = false;
        if (!filePath) return this.trajectory;

        try {
            await fs.writeFile(filePath, JSON.stringify(this.trajectory, null, 2));
        } catch (error) {
            throw new OperationError(`Failed to write trajectory to ${filePath}: ${(error as Error).message}`, {filePath});
        }
        return this.trajectory;
    }

    getTrajectory(): TrajectoryStep[] {
        return this.trajectory;
    }

    private setupEventListeners(): void {
        const events: Array<[keyof TrajectoryEventMap, string]> = [
            ['llm_prompt', 'llm_prompt'],
            ['tool_call', 'tool_call'],
            ['lm_response', 'lm_response'],
            ['lm_failure', 'lm_failure']
        ];

        events.forEach(([event, type]) => {
            this.eventBus.on(event as never, (data: any) => {
                this.logStep(type, data);
            });
        });
    }
}
