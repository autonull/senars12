import {
    authCommands,
    CommandRegistry,
    configCommands,
    connectionCommands,
    coreCommands,
    episodesCommands,
    lmCommands,
    memoryCommands,
    narCommands,
    rlfpCommands,
    selfCommands
} from '../../src/io';

/**
 * Register all built-in command sets with the registry. Commands read their
 * dependencies (NAR, ConnectionManager, EpisodicMemory) off the per-call
 * `CommandContext`, so no registry-time wiring is required.
 */
export function registerAllCommands(registry: CommandRegistry): void {
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
