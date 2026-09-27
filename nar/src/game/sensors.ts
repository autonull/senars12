import { clamp01, failClosed, type CognitionContext, type Sensor, type SensorReading } from './types.js';

/** C2-S1: capacity pressure + utilization from memory statistics. */
export class BagPressureSensor implements Sensor {
  readonly id = 'bag-pressure';
  read({ nar, focusBag }: CognitionContext): SensorReading {
    try {
      const stats = nar?.getStatistics();
      const pressure = stats?.memoryPressure ?? 0;
      const utilization = stats?.utilization ?? 0;
      const bagPressure = focusBag ? clamp01(focusBag.pressure()) : 0;
      return { features: { memoryPressure: pressure, utilization, bagOccupancy: bagPressure }, confidence: (stats || focusBag) ? 1 : 0 };
    } catch (e) { return failClosed(this.id, e); }
  }
}

/** C2-S2: task/demographic mix from aggregate statistics (low/medium/high priority). */
export class TaskTypeMixSensor implements Sensor {
  readonly id = 'task-type-mix';
  read({ nar }: CognitionContext): SensorReading {
    try {
      const d = nar?.getStatistics()?.conceptDistribution ?? { lowPriority: 0, mediumPriority: 0, highPriority: 0 };
      const total = Math.max(1, d.lowPriority + d.mediumPriority + d.highPriority);
      return {
        features: { lowShare: d.lowPriority / total, mediumShare: d.mediumPriority / total, highShare: d.highPriority / total },
        confidence: nar ? 1 : 0,
      };
    } catch (e) { return failClosed(this.id, e); }
  }
}

/** C2-S3: derivation backlog from the focus step report. */
export class DerivationBacklogSensor implements Sensor {
  readonly id = 'derivation-backlog';
  read({ report }: CognitionContext): SensorReading {
    try {
      const tasksProcessed = report?.tasksProcessed ?? 0;
      const derivations = report?.derivations ?? 0;
      return { features: { tasksProcessed, derivations, backlogRatio: derivations / Math.max(1, tasksProcessed) }, confidence: report ? 1 : 0 };
    } catch (e) { return failClosed(this.id, e); }
  }
}

/** C2-S4: veto + handover telemetry. */
export class VetoHandoverRateSensor implements Sensor {
  readonly id = 'veto-handover-rate';
  read({ vetoRate, outcome }: CognitionContext): SensorReading {
    try {
      return {
        features: {
          vetoRate: vetoRate ?? outcome?.vetoes ?? 0,
        },
        confidence: (vetoRate !== undefined || outcome) ? 1 : 0,
      };
    } catch (e) { return failClosed(this.id, e); }
  }
}

/** C2-S5: head health via status-report adapter. */
export class HeadHealthSensor implements Sensor {
  readonly id = 'head-health';
  read({ headHealth }: CognitionContext): SensorReading {
    try {
      const entries = Object.entries(headHealth ?? {});
      if (!entries.length) return { features: { healthyCount: 0, totalCount: 0, healthRatio: 1 }, confidence: 0 };
      const healthyCount = entries.filter(([, h]) => h.healthy).length;
      const avgScore = entries.reduce((s, [, h]) => s + (h.score ?? (h.healthy ? 1 : 0)), 0) / entries.length;
      return {
        features: { healthyCount, totalCount: entries.length, healthRatio: healthyCount / entries.length, avgScore },
        confidence: 1,
      };
    } catch (e) { return failClosed(this.id, e); }
  }
}

/** C2-S6: token spend from the step outcome. */
export class SpendSensor implements Sensor {
  readonly id = 'spend';
  read({ outcome }: CognitionContext): SensorReading {
    try {
      const tokens = outcome?.tokens ?? 0;
      return { features: { tokens, spendRate: tokens / Math.max(1, tokens + 1000) }, confidence: outcome ? 1 : 0 };
    } catch (e) { return failClosed(this.id, e); }
  }
}

/** C2-S7: governance queue depth (validation + approval). */
export class GovernanceQueueSensor implements Sensor {
  readonly id = 'governance-queues';
  read({ governanceQueues }: CognitionContext): SensorReading {
    try {
      const q = governanceQueues ?? { validation: 0, approval: 0 };
      return { features: { validation: q.validation, approval: q.approval, total: q.validation + q.approval }, confidence: governanceQueues ? 1 : 0 };
    } catch (e) { return failClosed(this.id, e); }
  }
}

export const DEFAULT_SENSORS: readonly Sensor[] = [
  new BagPressureSensor(),
  new TaskTypeMixSensor(),
  new DerivationBacklogSensor(),
  new VetoHandoverRateSensor(),
  new HeadHealthSensor(),
  new SpendSensor(),
  new GovernanceQueueSensor(),
];
