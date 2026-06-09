import {CommandRegistry} from '../io/commands/registry.js';
import {coreCommands} from '../io/commands/core.js';
import {connectionCommands} from '../io/commands/connection.js';
import {memoryCommands} from '../io/commands/memory.js';
import {narCommands} from '../io/commands/nar.js';
import {selfCommands} from '../io/commands/self.js';
import {lmCommands} from '../io/commands/lm.js';
import {rlfpCommands} from '../io/commands/rlfp.js';
import {configCommands} from '../io/commands/config.js';
import {episodesCommands} from '../io/commands/episodes.js';
import {authCommands} from '../io/commands/auth.js';
import type {NAR} from '../nar/nar.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {Connection} from '../io/types.js';
import type {ConnectionManager} from '../io/connection-manager.js';

export interface CommandDeps {
    nar?: NAR;
    episodicMemory?: EpisodicMemory;
    agent?: {chat(input: string): Promise<string>};
    getConnection?: (id: string) => Connection | undefined;
    listConnections?: () => ReadonlyMap<string, Connection>;
}

export function registerAllCommands(registry: CommandRegistry, _deps: CommandDeps = {}): void {
    for (const cmd of authCommands) registry.register(cmd);
    for (const cmd of coreCommands) registry.register(cmd);
    for (const cmd of connectionCommands) registry.register(cmd);
    for (const cmd of memoryCommands) registry.register(cmd);
    for (const cmd of narCommands) registry.register(cmd);
    for (const cmd of selfCommands) registry.register(cmd);
    for (const cmd of lmCommands) registry.register(cmd);
    for (const cmd of rlfpCommands) registry.register(cmd);
    for (const cmd of configCommands) registry.register(cmd);
    for (const cmd of episodesCommands) registry.register(cmd);
}
