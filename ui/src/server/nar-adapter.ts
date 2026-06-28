import type { NAR } from '../../../src/nar/nar.js';
import type { ConfigFieldType } from '../shared/protocol.js';
import type { NarAdapter } from './gateway.js';

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
      return nar.listConcepts().map((c: any) => ({
        term: c.term.toString(),
        priority: c.priority ?? 0.5,
        confidence: c.confidence ?? 0.9,
        getLinks() {
          return c.getLinks().map((l: any) => ({
            target: l.concept.term.toString(),
            strength: l.strength ?? 0.5,
          }));
        },
      }));
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
      if (key in configState) configState[key] = { ...configState[key]!, value };
    },
  };
}
