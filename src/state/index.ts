export type { StateEnvelope } from './codec';
export { decodeState, encodeState, NAR_STATE_SCHEMA_VERSION, STATE_CODEC_FORMAT } from './codec';
export type { ConsistencyBoundary } from './boundary';
export { BOUNDARY_FILENAME, decodeBoundary, EMPTY_BOUNDARY, encodeBoundary } from './boundary';
export type { KernelCheckpoint, KernelRewindPorts, RewindReport } from './checkpoint';
export {
  CHECKPOINT_RING_CAP,
  createKernelRewind,
  DEFAULT_CHECKPOINT_INTERVAL,
  KernelCheckpointRing,
  KernelRewind,
  REWIND_BASE_GAPS,
} from './checkpoint';
export { DEFAULT_NAR_STATE_PATH, readPersistedBoundary } from './persisted';