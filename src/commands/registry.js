import { assertDefined } from '../util/assert.ts';
import { NameRegistry } from '../util/registry';
export class CommandRegistry extends NameRegistry {
    constructor() {
        super({ unique: false });
    }
    register(cmd) {
        // Register by name
        this.map.set(cmd.name, cmd);
        // Register aliases
        for (const alias of cmd.aliases ?? []) {
            this.map.set(alias, cmd);
        }
    }
    async execute(name, args, context) {
        const cmd = assertDefined(this.get(name), `Unknown command: ${name}`);
        return cmd.execute(args, context);
    }
    get(name) {
        return this.map.get(name);
    }
    /** Expose the commands map for backward compatibility. */
    get commands() {
        return this.map;
    }
}
