import { join } from 'node:path';
import { BaseLedgerEntrySchema, createLedger, type Ledger } from '@senars/util/ledger';
import { sortBy } from '@senars/util';
import { z } from 'zod';
import { termsEqual } from '../../terms';
import { ensureDirSync } from '../../utils/fs.js';
import type { Concept } from '../concept.js';
import type { Memory } from '../memory.js';

export interface ConsolidationConfig {
  healthCheckInterval: number;
  decayRate: number;
  enableActivationPropagation: boolean;
  enableDecay: boolean;
  enableForgetting: boolean;
}

const DEFAULT_CONFIG: ConsolidationConfig = {
  healthCheckInterval: 100,
  decayRate: 0.01,
  enableActivationPropagation: true,
  enableDecay: true,
  enableForgetting: true,
};

/** Occupancy at which eviction starts, and at which it hardens into removal. */
const ARCHIVE_PRESSURE = 0.8;
const FORGET_PRESSURE = 0.9;

export class MemoryConsolidation {
  private config: ConsolidationConfig;
  private lastHealthCheck: number;
  private consolidationCount: number;
  private totalConceptsProcessed = 0;
  private totalConceptsForgotten = 0;
  private totalConceptsArchived = 0;

  constructor(config: ConsolidationConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.lastHealthCheck = 0;
    this.consolidationCount = 0;
  }

  get stats(): {
    consolidationCount: number;
    lastHealthCheck: number;
    totalConceptsProcessed: number;
    totalConceptsForgotten: number;
    totalConceptsArchived: number;
  } {
    return {
      consolidationCount: this.consolidationCount,
      lastHealthCheck: this.lastHealthCheck,
      totalConceptsProcessed: this.totalConceptsProcessed,
      totalConceptsForgotten: this.totalConceptsForgotten,
      totalConceptsArchived: this.totalConceptsArchived,
    };
  }

  checkHealth(memory: Memory): void {
    const now = Date.now();
    if (now - this.lastHealthCheck >= this.config.healthCheckInterval * 1000) {
      this.consolidate(memory);
      this.lastHealthCheck = now;
    }
  }

  consolidate(memory: Memory): void {
    const concepts = memory.listConcepts();

    if (this.config.enableActivationPropagation) {
      this.propagateActivation(concepts);
    }

    if (this.config.enableDecay) {
      this.applyDecay(concepts);
    }

    if (this.config.enableForgetting) {
      const { archived, forgotten } = this.evict(memory);
      this.record(concepts.length, archived, forgotten);
    }

    this.consolidationCount++;
  }

  /**
   * The one archive/forget policy. `Memory.consolidate` delegates here rather
   * than carrying a second copy of the thresholds, so the watchdog below reads
   * counters that actually move.
   */
  evict(memory: Memory): { archived: number; forgotten: number } {
    const pressure = memory.capacityPressure();
    const candidates = sortBy(
      memory.listConcepts().filter((c) => c.totalTasks === 0),
      (c) => c.priority
    );
    if (candidates.length === 0 || pressure <= ARCHIVE_PRESSURE) {
      return { archived: 0, forgotten: 0 };
    }

    const archiveCount = Math.ceil(candidates.length * Math.min(0.3, pressure - 0.5));
    const forgetCount =
      pressure > FORGET_PRESSURE
        ? Math.ceil(candidates.length * Math.min(0.2, pressure - 0.8))
        : 0;

    const archived = candidates
      .slice(0, archiveCount)
      .filter((c) => memory.archiveConcept(c)).length;
    const forgotten = candidates
      .slice(archiveCount, archiveCount + forgetCount)
      .filter((c) => memory.removeConcept(c.term)).length;

    return { archived, forgotten };
  }

  /** Consolidation telemetry — the watchdog's only input. */
  record(processed: number, archived: number, forgotten: number): void {
    this.totalConceptsProcessed += processed;
    this.totalConceptsArchived += archived;
    this.totalConceptsForgotten += forgotten;
  }

  reset(): void {
    this.consolidationCount = 0;
    this.lastHealthCheck = 0;
    this.totalConceptsProcessed = 0;
    this.totalConceptsForgotten = 0;
    this.totalConceptsArchived = 0;
  }

  private propagateActivation(concepts: Concept[]): void {
    const iterations = 2;
    for (let i = 0; i < iterations; i++) {
      for (const concept of concepts) {
        const activation = concept.priority;
        if (activation > 0.1) {
          const neighbors = this.getRelatedConcepts(concept, concepts);
          for (const neighbor of neighbors) {
            const boost = activation * 0.1;
            neighbor.priority = Math.min(1.0, neighbor.priority + boost);
          }
        }
      }
    }
  }

  private getRelatedConcepts(concept: Concept, allConcepts: Concept[]): Concept[] {
    const term = concept.term;
    const related: Concept[] = [];

    for (const c of allConcepts) {
      if (c === concept) continue;
      const cTerm = c.term;

      const termArgs = 'args' in term ? term.args : undefined;
      const cTermArgs = 'args' in cTerm ? cTerm.args : undefined;

      const subject = termArgs?.[0];
      const predicate = termArgs?.[1];
      const cSubject = cTermArgs?.[0];
      const cPredicate = cTermArgs?.[1];

      if (subject && cSubject && termsEqual(subject, cSubject)) {
        related.push(c);
      } else if (predicate && cPredicate && termsEqual(predicate, cPredicate)) {
        related.push(c);
      } else if (termsEqual(cTerm, term)) {
        related.push(c);
      }
    }

    return related.slice(0, 10);
  }

  private applyDecay(concepts: Concept[]): void {
    for (const concept of concepts) {
      const decay = this.config.decayRate * (1 - concept.priority);
      concept.priority = Math.max(0, concept.priority - decay);
    }
  }
}

export interface ConsolidationWatchdogConfig {
  enabled: boolean;
  intervalCycles: number;
  dedupRatioThreshold: number;
  promotedCountThreshold: number;
  alertWindowHours: number;
  logDir: string;
}

const DEFAULT_WATCHDOG_CONFIG: ConsolidationWatchdogConfig = {
  enabled: false,
  intervalCycles: 100,
  dedupRatioThreshold: 0.1,
  promotedCountThreshold: 0,
  alertWindowHours: 1,
  logDir: 'logs',
};

function getWatchdogSnapshotSchema() {
  return BaseLedgerEntrySchema.extend({
    cycle: z.number(),
    conceptCount: z.number(),
    totalTasks: z.number(),
    dedupRatio: z.number(),
    promotedCount: z.number(),
    archivedCount: z.number(),
    forgottenCount: z.number(),
    memoryPressure: z.number(),
    alerts: z.array(z.string()),
  });
}

type WatchdogSnapshotLedgerEntry = z.infer<ReturnType<typeof getWatchdogSnapshotSchema>>;

export interface WatchdogSnapshot {
  ts: number;
  cycle: number;
  conceptCount: number;
  totalTasks: number;
  dedupRatio: number;
  promotedCount: number;
  archivedCount: number;
  forgottenCount: number;
  memoryPressure: number;
  alerts: string[];
}

let watchdogEnabled = false;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;
let lastPromotedTime: number | null = null;
let promotedCount = 0;
let cycleCount = 0;
let watchdogLedger: Ledger<WatchdogSnapshotLedgerEntry> | null = null;

function getWatchdogLedger(): Ledger<WatchdogSnapshotLedgerEntry> | null {
  if (!watchdogLedger && watchdogEnabled) {
    try {
      const logDir = DEFAULT_WATCHDOG_CONFIG.logDir;
      ensureDirSync(logDir);
      watchdogLedger = createLedger<WatchdogSnapshotLedgerEntry>(
        logDir,
        getWatchdogSnapshotSchema(),
        { rollover: { daily: true, maxEntriesPerFile: 10_000, retentionDays: 30 } }
      );
    } catch {
      // Silently fail
    }
  }
  return watchdogLedger;
}

export function enableConsolidationWatchdog(config?: Partial<ConsolidationWatchdogConfig>): void {
  if (watchdogEnabled) return;
  watchdogEnabled = true;
  if (config) Object.assign(DEFAULT_WATCHDOG_CONFIG, config);
}

export function disableConsolidationWatchdog(): void {
  watchdogEnabled = false;
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}

export function getConsolidationWatchdogStatus(): { enabled: boolean; config: ConsolidationWatchdogConfig } {
  return { enabled: watchdogEnabled, config: { ...DEFAULT_WATCHDOG_CONFIG } };
}

export function recordConsolidationWatchdogCycle(memory: Memory, consolidation: MemoryConsolidation): void {
  if (!watchdogEnabled) return;

  cycleCount++;
  if (cycleCount % DEFAULT_WATCHDOG_CONFIG.intervalCycles !== 0) return;

  const stats = consolidation.stats;
  const concepts = memory.listConcepts();
  const totalTasks = concepts.reduce((sum, c) => sum + (c.totalTasks ?? 0), 0);
  const dedupRatio = stats.totalConceptsProcessed > 0
    ? stats.totalConceptsArchived / stats.totalConceptsProcessed
    : 0;

  const alerts: string[] = [];
  if (dedupRatio < DEFAULT_WATCHDOG_CONFIG.dedupRatioThreshold) {
    alerts.push(`dedupRatio ${dedupRatio.toFixed(3)} below threshold ${DEFAULT_WATCHDOG_CONFIG.dedupRatioThreshold}`);
  }

  if (promotedCount === 0) {
    if (lastPromotedTime && Date.now() - lastPromotedTime > DEFAULT_WATCHDOG_CONFIG.alertWindowHours * 3600_000) {
      alerts.push(`promotedCount == 0 for > ${DEFAULT_WATCHDOG_CONFIG.alertWindowHours}h`);
    }
  } else {
    lastPromotedTime = Date.now();
    promotedCount = 0; // Reset counter after logging
  }

  const snapshot: WatchdogSnapshot = {
    ts: Date.now(),
    cycle: cycleCount,
    conceptCount: concepts.length,
    totalTasks,
    dedupRatio,
    promotedCount: stats.totalConceptsArchived,
    archivedCount: stats.totalConceptsArchived,
    forgottenCount: stats.totalConceptsForgotten,
    memoryPressure: memory.capacityPressure(),
    alerts,
  };

  const ledger = getWatchdogLedger();
  if (ledger) {
    ledger.append({ ...snapshot, at: snapshot.ts } as WatchdogSnapshotLedgerEntry);
  }

  if (alerts.length > 0) {
    console.warn('[memory-watchdog] Alerts:', alerts.join('; '));
  }
}

export function recordPromotion(): void {
  promotedCount++;
  lastPromotedTime = Date.now();
}
