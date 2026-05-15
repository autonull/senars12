/**
 * SeNARS Agent Layer
 * High-level interface for end-user interaction
 */

import {NAR} from '../nar';
import {errMsg} from '../nar/utils/helpers.js';
import {createLogger, type Logger} from '../nar/logger/index.js';

export interface Embodiment {
    readonly name: string;

    start(agent: Agent): Promise<void>;

    stop(): Promise<void>;

    send(message: string): Promise<void>;

    onMessage(handler: (message: string) => void): void;
}

export interface Command {
    readonly name: string;
    readonly description: string;
    readonly usage: string;

    execute(args: string[], context: { nar: NAR; agent: Agent }): Promise<string>;
}

export interface AgentProfile {
    id: string;
    name: string;
    description: string;
    config: Record<string, unknown>;
    capabilities: string[];
}

export interface AgentCapabilities {
    reasoning: boolean;
    learning: boolean;
    toolUse: boolean;
    embodiment: string[];
    persistence: boolean;
    metacognition: boolean;
}

export class Agent {
    private readonly narInstance: NAR;
    private readonly embodiments: Embodiment[] = [];
    private commands: Map<string, Command> = new Map();
    private messageHandlers: Array<(message: string) => void> = [];
    private running = false;
    private profile: AgentProfile | null = null;
    private statePath: string | null = null;
    private readonly logger: Logger;

    constructor(
        nar: NAR,
        embodiments: Embodiment[] = []
    ) {
        this.narInstance = nar;
        this.embodiments = embodiments;
        this.logger = createLogger({scope: 'agent'});
    }

    getNAR(): NAR {
        return this.narInstance;
    }

    getEmbodiments(): Embodiment[] {
        return this.embodiments;
    }

    addEmbodiment(embodiment: Embodiment): void {
        this.embodiments.push(embodiment);
    }

    registerCommand(command: Command): void {
        this.commands.set(command.name, command);
    }

    private async _forEachEmbodiment(fn: (e: Embodiment) => Promise<void>, action: string): Promise<void> {
        await Promise.allSettled(this.embodiments.map(async e => {
            try { await fn(e); } catch (err) { this.logger.error(`Failed to ${action} embodiment ${e.name}: ${errMsg(err)}`); }
        }));
    }

    async start(): Promise<void> {
        if (this.running) return;
        this.running = true;
        await this._forEachEmbodiment(e => e.start(this), 'start');
    }

    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        await this._forEachEmbodiment(e => e.stop(), 'stop');
    }

    onMessage(handler: (message: string) => void): void {
        this.messageHandlers.push(handler);
    }

    async broadcast(message: string): Promise<void> {
        for (const handler of this.messageHandlers) {
            try {
                handler(message);
            } catch (error) {
                this.logger.error(`Message handler error: ${errMsg(error)}`);
            }
        }
    }

    async handleInput(message: string): Promise<string> {
        if (message.startsWith('.')) {
            const parts = message.slice(1).split(/\s+/);
            const cmdName = `.${parts[0]}`;
            const args = parts.slice(1);

            const command = this.commands.get(cmdName);
            if (command) {
                try {
                    return await command.execute(args, {nar: this.narInstance, agent: this});
                } catch (error) {
                    return `Error: ${errMsg(error)}`;
                }
            }
            return `Unknown command: ${cmdName}`;
        }

        try {
            await this.narInstance.input(message);
            return `✓ Added: ${message}`;
        } catch (error) {
            return `✗ Error: ${errMsg(error)}`;
        }
    }

    setProfile(profile: AgentProfile): void {
        this.profile = profile;
    }

    getProfile(): AgentProfile | null {
        return this.profile;
    }

    getCapabilities(): AgentCapabilities {
        return {
            reasoning: true,
            learning: true,
            toolUse: this.narInstance.tools.list().length > 0,
            embodiment: this.embodiments.map(e => e.name),
            persistence: !!this.statePath,
            metacognition: true
        };
    }

    getSelfDescription(): string {
        const caps = this.getCapabilities();
        const profile = this.profile ? this.profile.name : 'default';
        return `SeNARS Agent v12 - Profile: ${profile}
Capabilities:
  - Reasoning: ${caps.reasoning ? '✓' : '✗'}
  - Learning: ${caps.learning ? '✓' : '✗'}
  - Tool Use: ${caps.toolUse ? '✓' : '✗'}
  - Embodiments: ${caps.embodiment.join(', ') || 'none'}
  - Persistence: ${caps.persistence ? '✓' : '✗'}
  - Metacognition: ${caps.metacognition ? '✓' : '✗'}`;
    }

    private _resolveStatePath(path?: string): string { return path ?? this.statePath ?? 'agent-state.json'; }

    async saveState(path?: string): Promise<void> {
        const fs = await import('fs/promises');
        const statePath = this._resolveStatePath(path);
        await fs.writeFile(statePath, JSON.stringify({profile: this.profile, memory: await this.narInstance.getMemoryState(), timestamp: Date.now()}, null, 2));
        this.statePath = statePath;
    }

    async loadState(path?: string): Promise<void> {
        const fs = await import('fs/promises');
        const statePath = this._resolveStatePath(path);
        const {profile, memory} = JSON.parse(await fs.readFile(statePath, 'utf-8'));
        if (profile) this.profile = profile;
        if (memory) await this.narInstance.loadMemoryState(memory);
        this.statePath = statePath;
    }
}
