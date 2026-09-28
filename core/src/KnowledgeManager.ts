import { readJsonFileSync, writeJsonFileSync } from '@senars/util';

export class KnowledgeManager {
  private knowledge = new Map<string, string>();
  private readonly knowledgePath: string;
  private readonly persistKnowledge: boolean;

  constructor(opts: { knowledgePath?: string; persistKnowledge?: boolean } = {}) {
    this.knowledgePath = opts.knowledgePath ?? '.cache/agent-knowledge.json';
    this.persistKnowledge = opts.persistKnowledge ?? false;
    this.loadKnowledge();
  }

  saveKnowledge(): void {
    if (!this.persistKnowledge) return;
    try {
      writeJsonFileSync(this.knowledgePath, Object.fromEntries(this.knowledge));
    } catch {
      // fail silently on save
    }
  }

  know(key: string, value: string): void {
    this.knowledge.set(key, value);
    this.saveKnowledge();
  }

  knowGet(key: string): string | undefined {
    return this.knowledge.get(key);
  }

  knowList(): Array<{ key: string; value: string }> {
    return [...this.knowledge.entries()].map(([key, value]) => ({ key, value }));
  }

  private loadKnowledge(): void {
    if (!this.persistKnowledge) return;
    for (const [k, v] of Object.entries(readJsonFileSync<Record<string, unknown>>(this.knowledgePath, {}))) {
      if (typeof v === 'string') this.knowledge.set(k, v);
    }
  }
}

