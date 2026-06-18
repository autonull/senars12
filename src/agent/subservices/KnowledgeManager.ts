import fs from 'node:fs';
import path from 'node:path';

export class KnowledgeManager {
    private knowledge = new Map<string, string>();
    private knowledgePath: string;
    private persistKnowledge: boolean;

    constructor(opts: { knowledgePath?: string, persistKnowledge?: boolean } = {}) {
        this.knowledgePath = opts.knowledgePath ?? '.cache/agent-knowledge.json';
        this.persistKnowledge = opts.persistKnowledge ?? false;
        this.loadKnowledge();
    }

    private loadKnowledge(): void {
        if (!this.persistKnowledge) return;
        try {
            if (fs.existsSync(this.knowledgePath)) {
                const data = fs.readFileSync(this.knowledgePath, 'utf8');
                const parsed = JSON.parse(data);
                for (const [k, v] of Object.entries(parsed)) {
                    if (typeof k === 'string' && typeof v === 'string') {
                        this.knowledge.set(k, v);
                    }
                }
            }
        } catch {
            // fail silently on load
        }
    }

    saveKnowledge(): void {
        if (!this.persistKnowledge) return;
        try {
            const dir = path.dirname(this.knowledgePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, {recursive: true});
            }
            const obj = Object.fromEntries(this.knowledge);
            fs.writeFileSync(this.knowledgePath, JSON.stringify(obj, null, 2), 'utf8');
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

    knowList(): Array<{key: string; value: string}> {
        return [...this.knowledge.entries()].map(([key, value]) => ({key, value}));
    }

    getMap(): Map<string, string> {
        return this.knowledge;
    }
}
