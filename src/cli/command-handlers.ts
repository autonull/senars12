import type {NAR} from '../nar';
import {createLogger} from '../nar/logger';
import {CommandRegistry, createCommandContext, type CommandContext} from './commands/index.js';
import {CoreCommands} from './commands/CoreCommands.js';
import {NARDisplayCommands} from './commands/NARDisplayCommands.js';
import {SelfCommands} from './commands/SelfCommands.js';
import {RLFPCommands} from './commands/RLFPCommands.js';
import {LMCommands} from './commands/LMCommands.js';
import {MemoryCommands} from './commands/MemoryCommands.js';

export class CommandHandlers {
    private readonly logger = createLogger({scope: 'CLI'});
    private readonly nar: NAR;
    private readonly registry: CommandRegistry;
    private readonly ctx: CommandContext;

    constructor(nar: NAR) {
        this.nar = nar;
        this.ctx = createCommandContext(nar);
        this.registry = new CommandRegistry('CLI');

        const allCommands = [
            ...CoreCommands,
            ...NARDisplayCommands,
            ...SelfCommands,
            ...RLFPCommands,
            ...LMCommands,
            ...MemoryCommands
        ];
        for (const cmd of allCommands) {
            this.registry.register(cmd);
        }
    }

    handleCommand(input: string): void {
        const parts = input.split(/\s+/);
        const cmd = parts[0]!;
        const args = parts.slice(1);

        if (cmd === '.run') return void this.handleRun(args);
        if (cmd === '.stats') return void this.handleStats(args);
        if (cmd === '.config') return void this.handleConfig(args);
        if (cmd === '.quit') {
            this.logger.info('Goodbye!');
            process.exit(0);
        }

        const handler = this.registry.handle.bind(this.registry);
        try {
            handler(cmd, {...this.ctx, args});
        } catch (error) {
            this.logger.error(`Error: ${error}`);
        }
    }

    async handleBelief(term: string): Promise<void> {
        try {
            await this.nar.input(term);
            this.logger.info(`✓ Added: ${term}`);
        } catch (error) {
            this.logger.error(`✗ Error: ${error}`);
        }
    }

    async handleQuestion(term: string): Promise<void> {
        try {
            await this.nar.question(term);
            const derived = await this.nar.run(5);

            if (derived > 0) {
                this.logger.info(`✓ Derived ${derived} new belief(s)`);
            } else {
                this.logger.info('? No derivation found');
            }
        } catch (error) {
            this.logger.error(`✗ Error: ${error}`);
        }
    }

    private async handleRun(args: string[]): Promise<void> {
        const steps = args[0] ? parseInt(args[0]) : 5;
        this.logger.info(`⟳ Running ${steps} step(s)...`);
        const derived = await this.nar.run(steps);
        this.logger.info(`✓ Completed ${steps} step(s), derived ${derived} belief(s)`);
    }

    private handleStats(args: string[]): void {
        const stats = this.nar.getStatistics();
        this.logger.info(`Concepts: ${stats.totalConcepts}, Tasks: ${stats.totalTasks}`);

        if (args[0] === 'detail' || args[0] === 'all') {
            const metrics = this.nar.getMetrics?.();
            if (metrics) {
                const ruleExecs = metrics.rules?.reduce((sum, r) => sum + r.executions, 0) ?? 0;
                const derivs = metrics.system?.totalDerivations ?? 0;
                this.logger.info(`Rule Executions: ${ruleExecs}, Derivations: ${derivs}`);
            }
        }
    }

    private handleConfig(args: string[]): void {
        if (args.length === 0) {
            const config = this.nar.getConfig();
            this.logger.info('\nCurrent Configuration:');
            for (const [key, value] of Object.entries(config)) {
                this.logger.info(` ${key}: ${String(value)}`);
            }
            this.logger.info('');
            return;
        }

        if (args.length === 1) {
            const config = this.nar.getConfig();
            const value = config[args[0] as keyof typeof config];
            this.logger.info(`${args[0]}: ${String(value ?? 'unknown')}`);
            return;
        }

        if (args.length === 2) {
            const [key, value] = args;
            const typedValue = isNaN(Number(value)) ? value : Number(value);
            this.nar.setConfig({[key!]: typedValue});
            this.logger.info(`Set ${key} to ${typedValue}`);
        }
    }
}