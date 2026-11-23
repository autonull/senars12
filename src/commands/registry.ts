import { assertDefined } from '../util/assert.ts';
import type { CommandContext, CommandDefinition } from './types';
import { NameRegistry } from '../util/registry';

export class CommandRegistry extends NameRegistry<CommandDefinition> {
  constructor() {
    super({ unique: false });
  }

  override register(cmd: CommandDefinition): void {
    // Register by name
    this.map.set(cmd.name, cmd);
    // Register aliases
    for (const alias of cmd.aliases ?? []) {
      this.map.set(alias, cmd);
    }
  }

  async execute(name: string, args: string[], context: CommandContext): Promise<string> {
    const cmd = assertDefined(this.get(name), `Unknown command: ${name}`);
    return cmd.execute(args, context);
  }

  override get(name: string): CommandDefinition | undefined {
    return this.map.get(name);
  }

  /** Expose the commands map for backward compatibility. */
  get commands(): Map<string, CommandDefinition> {
    return this.map;
  }
}
