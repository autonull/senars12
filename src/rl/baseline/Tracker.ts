/**
 * RL Baseline Tracker — persistent tracking of baseline metrics.
 *
 * Stores episode results and computes metrics over time.
 * Supports checkpointing for long-running experiments.
 */

import { createJsonCodec } from '../../codec';
import { createCborCodec } from '../../codec';
import { createMsgpackCodec } from '../../codec';
import type { BaselineArmConfig, BaselineAlgorithm } from '../baselines';
import type { EpisodeResult, ArmMetrics, MetricsConfig } from './Metrics';
import { computeArmMetrics } from './Metrics';

/** Tracker configuration. */
export interface TrackerConfig {
  /** Maximum episodes to keep in memory (older ones archived). */
  maxEpisodesInMemory?: number;
  /** Path for persistent storage. */
  storagePath?: string;
  /** Metrics configuration. */
  metricsConfig?: MetricsConfig;
  /** Codec format for storage. */
  codecFormat?: 'json' | 'cbor' | 'msgpack';
}

/** Serializable tracker state. */
export interface TrackerState {
  version: number;
  episodes: EpisodeResult[];
  armConfigs: Map<string, BaselineArmConfig>;
  optimalRewards: Map<string, number>;
  createdAt: number;
  updatedAt: number;
}

/** RL Baseline Tracker. */
export class BaselineTracker {
  private episodes: EpisodeResult[] = [];
  private armConfigs = new Map<string, BaselineArmConfig>();
  private optimalRewards = new Map<string, number>();
  private config: Required<TrackerConfig>;
  private codec: any;

  constructor(config: TrackerConfig = {}) {
    this.config = {
      maxEpisodesInMemory: config.maxEpisodesInMemory ?? 10000,
      storagePath: config.storagePath ?? './rl-baseline-tracker.json',
      metricsConfig: config.metricsConfig ?? {},
      codecFormat: config.codecFormat ?? 'json',
    };

    // Initialize codec based on format
    switch (this.config.codecFormat) {
      case 'cbor':
        this.codec = createCborCodec<TrackerState>();
        break;
      case 'msgpack':
        this.codec = createMsgpackCodec<TrackerState>();
        break;
      default:
        this.codec = createJsonCodec<TrackerState>();
    }
  }

  /** Get the arm ID for a configuration. */
  private getArmId(armConfig: BaselineArmConfig): string {
    return `${armConfig.algorithm}:${armConfig.name}:${JSON.stringify(armConfig.config)}`;
  }

  /** Record an episode result. */
  recordEpisode(result: EpisodeResult): void {
    this.episodes.push(result);

    // Track arm config
    const armId = this.getArmId(result.armConfig);
    if (!this.armConfigs.has(armId)) {
      this.armConfigs.set(armId, result.armConfig);
    }

    // Prune old episodes if needed
    if (this.episodes.length > this.config.maxEpisodesInMemory) {
      this.episodes = this.episodes.slice(-this.config.maxEpisodesInMemory);
    }
  }

  /** Set the optimal reward for an arm (for regret computation). */
  setOptimalReward(armConfig: BaselineArmConfig, reward: number): void {
    const armId = this.getArmId(armConfig);
    this.optimalRewards.set(armId, reward);
  }

  /** Get optimal reward for an arm. */
  getOptimalReward(armConfig: BaselineArmConfig): number {
    const armId = this.getArmId(armConfig);
    return this.optimalRewards.get(armId) ?? 1.0;
  }

  /** Get all episodes for a specific arm. */
  getEpisodesForArm(armConfig: BaselineArmConfig): EpisodeResult[] {
    const armId = this.getArmId(armConfig);
    return this.episodes.filter(e => this.getArmId(e.armConfig) === armId);
  }

  /** Get metrics for a specific arm. */
  getArmMetrics(armConfig: BaselineArmConfig): ArmMetrics {
    const episodes = this.getEpisodesForArm(armConfig);
    const optimalReward = this.getOptimalReward(armConfig);
    return computeArmMetrics(episodes, optimalReward, this.config.metricsConfig);
  }

  /** Get metrics for all tracked arms. */
  getAllArmMetrics(): Map<string, ArmMetrics> {
    const metrics = new Map<string, ArmMetrics>();
    for (const [armId, armConfig] of this.armConfigs) {
      const episodes = this.episodes.filter(e => this.getArmId(e.armConfig) === armId);
      if (episodes.length > 0) {
        const optimalReward = this.optimalRewards.get(armId) ?? 1.0;
        metrics.set(armId, computeArmMetrics(episodes, optimalReward, this.config.metricsConfig));
      }
    }
    return metrics;
  }

  /** Get total episode count. */
  getTotalEpisodes(): number {
    return this.episodes.length;
  }

  /** Get episodes in a time range. */
  getEpisodesSince(since: number): EpisodeResult[] {
    return this.episodes.filter(e => e.metrics?.timestamp && e.metrics.timestamp > since);
  }

  /** Compare two arms. */
  compareArms(armConfigA: BaselineArmConfig, armConfigB: BaselineArmConfig): any {
    const episodesA = this.getEpisodesForArm(armConfigA);
    const episodesB = this.getEpisodesForArm(armConfigB);
    const optimalA = this.getOptimalReward(armConfigA);
    const optimalB = this.getOptimalReward(armConfigB);
    const optimalReward = Math.max(optimalA, optimalB);
    return this.compareEpisodes(episodesA, episodesB, optimalReward);
  }

  private compareEpisodes(episodesA: EpisodeResult[], episodesB: EpisodeResult[], optimalReward: number): any {
    const metricsA = computeArmMetrics(episodesA, optimalReward, this.config.metricsConfig);
    const metricsB = computeArmMetrics(episodesB, optimalReward, this.config.metricsConfig);

    const rewardsA = episodesA.map(r => r.reward);
    const rewardsB = episodesB.map(r => r.reward);

    // Simple t-test approximation
    const meanA = rewardsA.reduce((a, b) => a + b, 0) / rewardsA.length;
    const meanB = rewardsB.reduce((a, b) => a + b, 0) / rewardsB.length;
    const stdA = Math.sqrt(rewardsA.reduce((sum, r) => sum + (r - meanA) ** 2, 0) / (rewardsA.length - 1));
    const stdB = Math.sqrt(rewardsB.reduce((sum, r) => sum + (r - meanB) ** 2, 0) / (rewardsB.length - 1));
    const nA = rewardsA.length;
    const nB = rewardsB.length;

    const pooledStd = Math.sqrt(((nA - 1) * stdA * stdA + (nB - 1) * stdB * stdB) / (nA + nB - 2));
    const tStat = (meanA - meanB) / (pooledStd * Math.sqrt(1 / nA + 1 / nB));
    const pValue = 2 * (1 - this.studentTCdf(Math.abs(tStat), nA + nB - 2));

    const effectSize = (meanA - meanB) / pooledStd;
    const significant = pValue < 0.05;
    let betterArm: 'A' | 'B' | 'tie' = 'tie';
    if (significant) betterArm = meanA > meanB ? 'A' : 'B';

    return { metricsA, metricsB, pValue, significant, effectSize, betterArm };
  }

  private studentTCdf(t: number, df: number): number {
    if (df <= 0) return 0;
    if (df > 100) {
      // Math.erf polyfill
      const erf = (x: number) => {
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1 / (1 + p * x);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
      };
      return 0.5 * (1 + erf(t / Math.sqrt(2)));
    }
    const x = df / (t * t + df);
    const a = df / 2;
    return 1 - 0.5 * Math.pow(x, a) * (1 + a * (1 - x) / 1.5);
  }

  /** Get serializable state for checkpointing. */
  getState(): TrackerState {
    return {
      version: 1,
      episodes: this.episodes,
      armConfigs: this.armConfigs,
      optimalRewards: this.optimalRewards,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /** Restore state from checkpoint. */
  setState(state: TrackerState): void {
    this.episodes = state.episodes;
    this.armConfigs = state.armConfigs;
    this.optimalRewards = state.optimalRewards;
  }

  /** Save tracker state to disk. */
  async save(): Promise<void> {
    const fs = await import('fs/promises');
    const state = this.getState();
    const bytes = this.codec.serialize(state);
    await fs.writeFile(this.config.storagePath, bytes);
  }

  /** Load tracker state from disk. */
  async load(): Promise<void> {
    const fs = await import('fs/promises');
    try {
      const bytes = await fs.readFile(this.config.storagePath);
      const state = this.codec.deserialize(bytes);
      this.setState(state);
    } catch {
      // File doesn't exist or corrupted - start fresh
    }
  }

  /** Clear all tracked data. */
  clear(): void {
    this.episodes = [];
    this.armConfigs.clear();
    this.optimalRewards.clear();
  }
}