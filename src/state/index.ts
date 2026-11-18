export type { StateEnvelope } from './codec.js';
export { decodeState, encodeState, NAR_STATE_SCHEMA_VERSION, STATE_CODEC_FORMAT } from './codec.js';
export type { ConsistencyBoundary } from './boundary.js';
export { BOUNDARY_FILENAME, decodeBoundary, EMPTY_BOUNDARY, encodeBoundary } from './boundary.js';
export type { KernelCheckpoint, KernelRewindPorts, RewindReport } from './checkpoint.js';
export {
  CHECKPOINT_RING_CAP,
  createKernelRewind,
  DEFAULT_CHECKPOINT_INTERVAL,
  KernelCheckpointRing,
  KernelRewind,
  REWIND_BASE_GAPS,
} from './checkpoint.js';
export { DEFAULT_NAR_STATE_PATH, readPersistedBoundary } from './persisted.js';