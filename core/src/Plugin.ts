import type { CognitiveEvent } from './CognitiveEvent.js';

export interface PluginContext {
  onCognitive(handler: (e: CognitiveEvent) => void): () => void;
  addMemoryTier(name: string, impl: unknown): void;
}

export interface SenarsPlugin {
  id: string;
  name: string;
  version: string;
  activate(ctx: PluginContext): void;
  deactivate(): void;
}
