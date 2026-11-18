import {
  type AuthManager,
  CommandRegistry,
  connectionCommands,
  createAuthCommands,
} from '../../../io/index.js';
import {
  coreCommands,
  episodesCommands,
  lmCommands,
  memoryCommands,
  narCommands,
  rlfpCommands,
  selfCommands,
} from '../../../agent/index.js';

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
