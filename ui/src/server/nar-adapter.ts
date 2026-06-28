import type { NAR } from '../../../src/nar/nar.js';
import type { ConfigFieldType } from '../shared/protocol.js';
import type { NarAdapter } from './gateway.js';
import { findConflicts } from '../../../src/nar/cognitive/conflict-utils.js';

interface ConceptLike {
  term: { toString(): string } | string;
  priority?: number;
  confidence?: number;
  getLinks(): Array<{ concept: { term: { toString(): string } | string }; strength?: number }>;
}

interface BeliefLike {
  a: { toString(): string };
  b: { toString(): string };
}

interface AttentionReport {
  concepts: Array<{ term: string; priority: number }>;
}

interface DriveManager {
  getAllStates(): Array<{ spec: { id: string | number; name: string }; currentIntensity: number; isActive: boolean }>;
}

interface MetricsSummary {
  system?: { totalSteps: number };
  lm?: { tokenUsage: { total: number } };
}

class ConfigManager {
  private state: Record<string, ConfigFieldType> = {
    'llm.provider': { type: 'dropdown', label: 'LM Provider', value: 'openai', options: ['openai', 'anthropic', 'google', 'groq', 'ollama', 'custom'] },
    'llm.model': { type: 'text', label: 'Model', value: 'gpt-4o' },
    'llm.api_key': { type: 'text', label: 'API Key', value: '' },
    'llm.base_url': { type: 'text', label: 'API Base URL', value: '' },
    'llm.temperature': { type: 'slider', label: 'Temperature', value: 0.7, min: 0, max: 2, step: 0.1 },
    'nars.revision_rate': { type: 'slider', label: 'NARS Revision Rate', value: 0.5, min: 0, max: 1, step: 0.1 },
    'nars.max_concepts': { type: 'text', label: 'Max Concepts', value: '1000' },
  };

  getSchema() { return this.state; }

  setConfig(key: string, value: unknown, nar?: NAR): void {
    if (!(key in this.state)) return;
    this.state[key] = { ...this.state[key], value } as ConfigFieldType;

    if (key === 'nars.max_concepts' && nar) {
      nar.setConfig({ maxConcepts: Number(value) });
    }
    if (key === 'llm.provider' && typeof value === 'string') {
      process.env.LM_PROVIDER = value;
    }
    if (key === 'llm.model' && typeof value === 'string') {
      process.env.LM_MODEL = value;
    }
    if (key === 'llm.api_key' && typeof value === 'string') {
      process.env.OPENAI_API_KEY = value;
    }
  }
}

function mapConcept(c: ConceptLike, conflictTerms: Set<string>) {
  const termStr = c.term.toString();
  const lensData = conflictTerms.has(termStr) ? { score: 1, color: 'rgba(255, 0, 255, 1)', size: 50 } : undefined;

  return {
    term: termStr,
    priority: c.priority ?? 0.5,
    confidence: c.confidence ?? 0.9,
    lensData,
    getLinks() {
      return c.getLinks().map((l) => ({ target: l.concept.term.toString(), strength: l.strength ?? 0.5 }));
    },
  };
}

export function buildNarAdapter(nar: NAR): NarAdapter {
  const config = new ConfigManager();

  return {
    listConcepts() {
      const concepts = nar.listConcepts() as unknown as ConceptLike[];
      const beliefs = nar.getBeliefs() as unknown;
      const conflicts = findConflicts(beliefs as never);
      const conflictTerms = new Set<string>();
      for (const c of conflicts) {
        conflictTerms.add(c.a.toString());
        conflictTerms.add(c.b.toString());
      }
      return concepts.map((c) => mapConcept(c, conflictTerms));
    },
    getSystemEventBus() { return nar.getSystemEventBus(); },
    attentionReport() {
      const report = nar.attentionReport() as AttentionReport;
      return { concepts: report.concepts.map((c) => ({ term: c.term, priority: c.priority })) };
    },
    getDriveManager(): ReturnType<NarAdapter['getDriveManager']> {
      const dm = nar.getDriveManager?.() as DriveManager | undefined;
      if (!dm) return undefined;
      return {
        getAllStates() {
          return dm.getAllStates().map((d) => ({
            spec: { id: String(d.spec.id), name: String(d.spec.name) },
            currentIntensity: Number(d.currentIntensity),
            isActive: Boolean(d.isActive),
          }));
        },
      };
    },
    getConfigSchema: () => config.getSchema(),
    setConfig(key: string, value: unknown) { config.setConfig(key, value, nar); },
  };
}

export function createTelemetryEmitter(nar: NAR, send: (msg: { type: 'telemetry'; metrics: { reasoning_hz: number; tokens_per_sec: number; memory_mb: number; ws_latency_ms: number } }) => void, intervalMs = 1000): () => void {
  let cycleCount = 0;
  let lastTick = Date.now();
  const timer = setInterval(() => {
    const summary = nar.getMetrics() as MetricsSummary;
    const cycleDelta = (summary.system?.totalSteps ?? 0) - cycleCount;
    cycleCount = summary.system?.totalSteps ?? 0;
    const elapsed = (Date.now() - lastTick) / 1000;
    lastTick = Date.now();

    send({
      type: 'telemetry',
      metrics: {
        reasoning_hz: elapsed > 0 ? cycleDelta / elapsed : 0,
        tokens_per_sec: summary.lm?.tokenUsage.total ?? 0,
        memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        ws_latency_ms: 0,
      },
    });
  }, intervalMs);
  return () => clearInterval(timer);
}