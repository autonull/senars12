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

        this.registry.register({name: '.help', description: '', usage: '', handler: () => {}});
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

        const handlers: Record<string, () => void | Promise<void>> = {
            '.help': () => this.registry.handle('.help', this.ctx),
            '.run': () => this.handleRun(args),
            '.stats': () => this.handleStats(args),
            '.list': () => this.registry.handle('.list', this.ctx),
            '.concepts': () => this.registry.handle('.concepts', this.ctx),
            '.rules': () => this.registry.handle('.rules', this.ctx),
            '.tools': () => this.registry.handle('.tools', this.ctx),
            '.config': () => this.handleConfig(args),
            '.clear': () => this.registry.handle('.clear', this.ctx),
            '.load': () => this.registry.handle('.load', this.ctx),
            '.save': () => this.registry.handle('.save', this.ctx),
            '.query': () => this.registry.handle('.query', this.ctx),
            '.trace': () => this.registry.handle('.trace', this.ctx),
            '.explain': () => this.registry.handle('.explain', this.ctx),
            '.self': () => this.registry.handle('.self', this.ctx),
            '.meta': () => this.registry.handle('.meta', this.ctx),
            '.optimize': () => this.registry.handle('.optimize', this.ctx),
            '.prefer': () => this.registry.handle('.prefer', this.ctx),
            '.reward': () => this.registry.handle('.reward', this.ctx),
            '.rlfp-stats': () => this.registry.handle('.rlfp-stats', this.ctx),
            '.lm-status': () => this.registry.handle('.lm-status', this.ctx),
            '.lm-switch': () => this.registry.handle('.lm-switch', this.ctx),
            '.ask-nl': () => this.registry.handle('.ask-nl', this.ctx),
            '.constitution': () => this.registry.handle('.constitution', this.ctx),
            '.attention': () => this.registry.handle('.attention', this.ctx),
            '.load-domain': () => this.registry.handle('.load-domain', this.ctx),
            '.quit': () => {
                this.logger.info('Goodbye!');
                process.exit(0);
            }
        };

        const handler = handlers[cmd];
        if (handler) {
            try {
                handler();
            } catch (error) {
                this.logger.error(`Error: ${error}`);
            }
        } else {
            this.logger.warn(`Unknown command: ${cmd}. Type .help for commands.`);
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