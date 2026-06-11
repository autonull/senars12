import {promises as fs} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {AgentEventBus} from './AgentEventBus.js';

export interface Goal {
    id: string;
    description: string;
    status: 'pending' | 'active' | 'blocked' | 'done' | 'failed';
    subgoals: string[];
    progress: number;
    createdAt: number;
    updatedAt: number;
    priority: number;
}

export interface GoalManagerOptions {
    eventBus: AgentEventBus;
    episodicMemory?: EpisodicMemory;
    persistPath?: string;
}

export class GoalManager {
    private readonly goals: Goal[] = [];
    private readonly eventBus: AgentEventBus;
    private readonly episodicMemory?: EpisodicMemory;
    private readonly persistPath?: string;
    private loaded = false;

    constructor(opts: GoalManagerOptions) {
        this.eventBus = opts.eventBus;
        this.episodicMemory = opts.episodicMemory;
        this.persistPath = opts.persistPath;
    }

    addGoal(description: string, priority = 0): Goal {
        const goal: Goal = {
            id: randomUUID(),
            description,
            status: 'pending',
            subgoals: [],
            progress: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            priority,
        };
        this.goals.push(goal);
        this.eventBus.emit('goal:created', {
            goalId: goal.id,
            description: goal.description,
            priority: goal.priority,
            timestamp: Date.now(),
        });
        return goal;
    }

    getActiveGoal(): Goal | undefined {
        return this.goals.find(g => g.status === 'active');
    }

    getGoals(): readonly Goal[] {
        return this.goals;
    }

    advance(): Goal | undefined {
        const active = this.getActiveGoal();
        if (active) return active;

        const next = this.goals
            .filter(g => g.status === 'pending')
            .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];

        if (next) {
            next.status = 'active';
            next.updatedAt = Date.now();
            this.eventBus.emit('goal:started', {
                goalId: next.id,
                description: next.description,
                timestamp: Date.now(),
            });
        }

        return next;
    }

    updateProgress(goalId: string, progress: number): void {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;
        goal.progress = Math.max(0, Math.min(1, progress));
        goal.updatedAt = Date.now();
    }

    completeGoal(goalId: string): void {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;
        goal.status = 'done';
        goal.progress = 1;
        goal.updatedAt = Date.now();
        this.eventBus.emit('goal:completed', {
            goalId: goal.id,
            description: goal.description,
            progress: goal.progress,
            timestamp: Date.now(),
        });
    }

    failGoal(goalId: string): void {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;
        goal.status = 'failed';
        goal.updatedAt = Date.now();
        this.eventBus.emit('goal:failed', {
            goalId: goal.id,
            description: goal.description,
            timestamp: Date.now(),
        });
    }

    blockGoal(goalId: string): void {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;
        goal.status = 'blocked';
        goal.updatedAt = Date.now();
    }

    addSubgoal(parentId: string, description: string, priority?: number): Goal | undefined {
        const parent = this.goals.find(g => g.id === parentId);
        if (!parent) return undefined;
        const sub = this.addGoal(description, priority ?? parent.priority);
        sub.subgoals.push(parentId);
        parent.subgoals.push(sub.id);
        return sub;
    }

    async persist(): Promise<void> {
        if (this.episodicMemory) {
            await this.episodicMemory.log('input', JSON.stringify(this.goals), {
                kind: 'goal_snapshot',
                count: this.goals.length,
            }).catch(() => {});
        }
        if (this.persistPath) {
            const dir = dirname(this.persistPath);
            await fs.mkdir(dir, {recursive: true}).catch(() => {});
            await fs.writeFile(this.persistPath, JSON.stringify(this.goals, null, 2), 'utf-8').catch(() => {});
        }
    }

    async load(): Promise<void> {
        if (this.loaded || !this.persistPath) return;
        try {
            const data = await fs.readFile(this.persistPath, 'utf-8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                this.goals.length = 0;
                this.goals.push(...parsed);
            }
        } catch {
            // file missing or invalid — start fresh
        }
        this.loaded = true;
    }
}
