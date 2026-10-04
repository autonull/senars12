/**
 * Bin-level environment configuration (storage, auth, app shell).
 * Transport addresses resolve through `createConnectionConfigsFromEnv`
 * (`@senars/io`) — the single source of truth for `ENABLE_*` gates.
 */

import { cachePath, envBool, envCsv, envInt, envStr, envStrOr } from '@senars/util/config';

export interface EpisodicConfig {
  memoryPath: string;
  retentionDays: number;
}

export interface AuthConfig {
  secret: string | undefined;
  connectionIds: string[];
}

export interface AppEnvConfig {
  enableWebUI: boolean;
  histfile: string;
}

export interface BinEnvConfig {
  episodic: EpisodicConfig;
  auth: AuthConfig;
  app: AppEnvConfig;
}

export function readEpisodicConfig(): EpisodicConfig {
  return {
    memoryPath: envStrOr(cachePath('episodes'), 'EPISODIC_MEMORY_PATH'),
    retentionDays: envInt('EPISODIC_RETENTION_DAYS', 30),
  };
}

export function readAuthConfig(): AuthConfig {
  return {
    secret: envStr('AUTH_SECRET'),
    connectionIds: envCsv(['irc-main', 'http-main', 'ws-main'], 'AUTH_CONNECTION_IDS'),
  };
}

export function readAppEnvConfig(): AppEnvConfig {
  return {
    enableWebUI: envBool('ENABLE_WEB_UI'),
    histfile: envStrOr('/tmp/senars_history', 'SENARS_HISTFILE'),
  };
}
