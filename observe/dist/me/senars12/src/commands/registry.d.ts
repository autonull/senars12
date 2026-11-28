import type { CommandContext, CommandDefinition } from './types';
import { NameRegistry } from '../util/registry';
export declare class CommandRegistry extends NameRegistry<CommandDefinition> {
    constructor();
    register(cmd: CommandDefinition): void;
    execute(name: string, args: string[], context: CommandContext): Promise<string>;
    get(name: string): CommandDefinition | undefined;
    /** Expose the commands map for backward compatibility. */
    get commands(): Map<string, CommandDefinition>;
}
//# sourceMappingURL=registry.d.ts.map