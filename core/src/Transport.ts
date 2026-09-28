/**
 * Re-export of the canonical transport contracts owned by `@senars/util`. Kept
 * as a module path for existing internal imports; declarations live in one place.
 *
 * `ConnectionError` stays declared here: it carries transport-specific detail
 * (`connectionId`, `recoverable`) that the generic `SenarsError` lacks.
 */
export type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
  Logger,
  MessageClassification,
  TransportDeps,
} from '@senars/util/types/transport';

export class ConnectionError extends Error {
  override name = 'ConnectionError';

  constructor(
    message: string,
    readonly connectionId: string,
    readonly code: string,
    readonly recoverable: boolean,
    override readonly cause?: Error
  ) {
    super(message);
  }
}
