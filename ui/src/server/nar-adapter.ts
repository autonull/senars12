import type { NAR } from '../../../src/nar/nar.js';
import type { ConfigFieldType, Lens } from '../shared/protocol.js';
import type { NarAdapter } from './gateway.js';
import { findConflicts } from '../../../src/nar/cognitive/conflict-utils.js';

const configState: Record<string, ConfigFieldType> = {
  'llm.provider': { type: 'dropdown', label: 'LM Provider', value: 'openai', options: ['openai', 'anthropic', 'google', 'groq', 'ollama', 'custom'] },
  'llm.model': { type: 'text', label: 'Model', value: 'gpt-4o' },
  'llm.api_key': { type: 'text', label: 'API Key', value: '' },
  'llm.base_url': { type: 'text', label: 'API Base URL', value: '' },
  'llm.temperature': { type: 'slider', label: 'Temperature', value: 0.7, min: 0, max: 2, step: 0.1 },
  'nars.revision_rate': { type: 'slider', label: 'NARS Revision Rate', value: 0.5, min: 0, max: 1, step: 0.1 },
  'nars.max_concepts': { type: 'text', label: 'Max Concepts', value: '1000' },
};

export function getConfigSchema(): Record<string, ConfigFieldType> {
  return configState;
}

export function buildNarAdapter(nar: NAR): NarAdapter {
  return {
    listConcepts() {
      const concepts = nar.listConcepts();
      const beliefs = nar.getBeliefs();
      const conflicts = findConflicts(beliefs);
      const conflictTerms = new Set<string>();
      for (const c of conflicts) {
        conflictTerms.add(c.a.toString());
        conflictTerms.add(c.b.toString());
      }

      return concepts.map((c: any) => {
        const termStr = c.term.toString();
        const isContradiction = conflictTerms.has(termStr);
        const lensData = isContradiction ? {
          score: 1,
          color: 'rgba(255, 0, 255, 1)',
          size: 50,
        } : undefined;

        return {
          term: termStr,
          priority: c.priority ?? 0.5,
          confidence: c.confidence ?? 0.9,
          lensData,
          getLinks() {
            return c.getLinks().map((l: any) => ({
              target: l.concept.term.toString(),
              strength: l.strength ?? 0.5,
            }));
          },
        };
      });
    },
    getSystemEventBus() {
      return nar.getSystemEventBus();
    },
    attentionReport() {
      const report = nar.attentionReport();
      return { concepts: report.concepts.map((c: any) => ({ term: c.term, priority: c.priority })) };
    },
    getDriveManager(): ReturnType<NarAdapter['getDriveManager']> {
      const dm = nar.getDriveManager?.();
      if (!dm) return undefined;
      return {
        getAllStates() {
          return dm.getAllStates().map((d: any) => ({
            spec: { id: String(d.spec.id), name: String(d.spec.name) },
            currentIntensity: Number(d.currentIntensity),
            isActive: Boolean(d.isActive),
          }));
        },
      };
    },
    getConfigSchema,
    setConfig(key: string, value: any) {
      if (key in configState) {
        configState[key] = { ...configState[key]!, value };
        if (key === 'nars.max_concepts') {
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
    },
  };
}

export function createTelemetryEmitter(nar: NAR, send: (msg: any) => void, intervalMs = 1000): () => void {
  let cycleCount = 0;
  let lastDerivations = 0;
  let lastTick = Date.now();
  const timer = setInterval(() => {
    const summary = nar.getMetrics();
    const cycleDelta = (summary.system?.totalSteps ?? 0) - cycleCount;
    const derivationDelta = (summary.system?.totalDerivations ?? 0) - lastDerivations;
    cycleCount = summary.system?.totalSteps ?? 0;
    lastDerivations = summary.system?.totalDerivations ?? 0;
    const elapsed = (Date.now() - lastTick) / 1000;
    lastTick = Date.now();

    send({
      type: 'telemetry',
      metrics: {
        reasoning_hz: elapsed > 0 ? cycleDelta / elapsed : 0,
        tokens_per_sec: summary.lm?.tokenUsage.total ?? 0,
        memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        ws_latency_ms: 0
      }
    });
  }, intervalMs);
  return () => clearInterval(timer);
}
