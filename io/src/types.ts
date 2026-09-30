/**
 * Transport types for `io`. Every one of them is declared once in the leaf
 * package that owns it — `io` re-exports, it does not re-declare. It used to
 * re-declare `Connection` and `ConnectionFactory`, and the `readonly type` on
 * its copy of the factory made an `io` factory unassignable to the
 * `util` contract `core` builds transports against.
 */
export type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
  TransportDeps,
} from '@senars/util';
export { ConnectionError } from '@senars/util';