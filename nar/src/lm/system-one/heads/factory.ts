import type { CalibrationVersion, EmbeddingCache } from '../types.js';

export interface PerHeadConfig {
  modelDigest: string;
  calibrationVersion: CalibrationVersion;
  abstainThreshold: number;
  enabled: boolean;
}

export interface HeadFactoryOptions {
  calibrationVersion: CalibrationVersion;
  embeddingCache: EmbeddingCache;
  abstainThreshold: number;
  perHeadConfig?: Record<string, PerHeadConfig>;
}
