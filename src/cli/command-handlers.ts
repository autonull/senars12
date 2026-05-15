import {CommandRegistry, createCommandContext, type CommandContext} from './commands/index.js';
import {CoreCommands} from './commands/CoreCommands.js';
import {NARDisplayCommands} from './commands/NARDisplayCommands.js';
import {SelfCommands} from './commands/SelfCommands.js';
import {RLFPCommands} from './commands/RLFPCommands.js';
import {LMCommands} from './commands/LMCommands.js';
import {MemoryCommands} from './commands/MemoryCommands.js';

export class CommandHandlers {
    private readonly registry: CommandRegistry;
    private readonly ctx: CommandContext;

    constructor(nar: Parameters<typeof createCommandContext>[0]) {
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

	async handleCommand(input: string): Promise<void> {
		const parts = input.split(/\s+/);
		const cmd = parts[0]!;
		const args = parts.slice(1);

		if (cmd === '.quit') {
			process.exit(0);
		}

		try {
			await this.registry.handle(cmd, {...this.ctx, args});
		} catch (error) {
			this.ctx.logger.error(`Error: ${error}`);
		}
	}
}