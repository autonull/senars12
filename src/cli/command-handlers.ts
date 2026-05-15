import type {NAR} from '../nar';
import {CommandRegistry, createCommandContext, type CommandContext} from './commands/index.js';
import {CoreCommands} from './commands/CoreCommands.js';
import {NARDisplayCommands} from './commands/NARDisplayCommands.js';
import {SelfCommands} from './commands/SelfCommands.js';
import {RLFPCommands} from './commands/RLFPCommands.js';
import {LMCommands} from './commands/LMCommands.js';
import {MemoryCommands} from './commands/MemoryCommands.js';

export class CommandHandlers {
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

        if (cmd === '.quit') {
            process.exit(0);
        }

        try {
            this.registry.handle(cmd, {...this.ctx, args});
        } catch (error) {
            this.ctx.logger.error(`Error: ${error}`);
        }
    }

    async handleBelief(term: string): Promise<void> {
        try {
            await this.nar.input(term);
            this.ctx.logger.info(`✓ Added: ${term}`);
        } catch (error) {
            this.ctx.logger.error(`✗ Error: ${error}`);
        }
    }

    async handleQuestion(term: string): Promise<void> {
        try {
            await this.nar.question(term);
            const derived = await this.nar.run(5);

            if (derived > 0) {
                this.ctx.logger.info(`✓ Derived ${derived} new belief(s)`);
            } else {
                this.ctx.logger.info('? No derivation found');
            }
        } catch (error) {
            this.ctx.logger.error(`✗ Error: ${error}`);
        }
    }
}