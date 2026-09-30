/**
 * Re-export of the canonical transport contracts owned by `@senars/util`. Kept
 * as a module path for existing internal imports; declarations live in one place.
 *
 * `ConnectionError` is the util class too: transport detail (`connectionId`,
 * `code`, `recoverable`) rides in its typed context, so a transport failure is
 * catchable as either the class or the `CONNECTION_ERROR` code.
 */

export { ConnectionError } from '@senars/util/errors';
export type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
  MessageClassification,
  TransportDeps,
} from '@senars/util/types/transport';
