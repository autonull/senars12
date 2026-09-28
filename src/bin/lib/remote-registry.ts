import { type AuthManager, CommandRegistry, connectionCommands, createAuthCommands } from '@senars/io';
import {
  configCommands,
  coreCommands,
  episodesCommands,
  lmCommands,
  memoryCommands,
  narCommands,
  rlfpCommands,
  selfCommands,
} from '@senars/nar/commands';

/**
 * Remote-transport command surface. One registry is built per bot and shared by
 * every connection it binds — the command set is fixed after construction, so
 * per-connection copies were pure duplication.
 */
export const createRemoteRegistry = (auth: AuthManager): CommandRegistry => {
  const registry = new CommandRegistry();
  for (const command of [
    ...coreCommands,
    ...narCommands,
    ...memoryCommands,
    ...episodesCommands,
    ...configCommands,
    ...lmCommands,
    ...rlfpCommands,
    ...selfCommands,
    ...connectionCommands,
    ...createAuthCommands(auth),
  ]) {
    registry.register(command);
  }
  return registry;
};
