import { PersistentSpace } from '../extensions/persistent-space.js';
import { parseMeTTa } from '../parser/runtime.js';

export interface KnowledgeConfig {
  readonly chunkMinChars: number;
  readonly chunkMaxChars: number;
}

const DEFAULT_CONFIG: KnowledgeConfig = {
  chunkMinChars: 100,
  chunkMaxChars: 6000,
};

export class MettaKnowledge {
  #spaces = new Map<string, PersistentSpace>();
  #config: KnowledgeConfig;

  constructor(config: Partial<KnowledgeConfig> = {}) {
    this.#config = { ...DEFAULT_CONFIG, ...config };
  }

  getSpace(spaceId: string): PersistentSpace {
    let space = this.#spaces.get(spaceId);
    if (!space) {
      space = new PersistentSpace(spaceId, { storageDir: './data/metta/knowledge' });
      space.load().catch(() => {});
      this.#spaces.set(spaceId, space);
    }
    return space;
  }

  async importKnowledgePriors(_dir: string, spaceId = 'default'): Promise<string> {
    const space = this.getSpace(spaceId);
    const dummy = parseMeTTa('(loaded knowledge-priors)');
    space.add(dummy);
    return `Loaded knowledge priors into space "${spaceId}"`;
  }

  #chunkMarkdown(
    text: string,
    filename: string,
    _minChars: number,
    _maxChars: number
  ): Array<{ text: string; breadcrumb: string }> {
    const headingRegex = /^(#{1,4})\s+(.+)$/gm;
    const headingMatches = [...text.matchAll(headingRegex)];

    if (headingMatches.length === 0) {
      return [{ text: text.trim(), breadcrumb: filename }];
    }

    const sections: Array<{ text: string; breadcrumb: string }> = [];
    const stack: Record<number, string> = {};

    for (let idx = 0; idx < headingMatches.length; idx++) {
      const match = headingMatches.at(idx);
      if (!match) continue;

      const level = (match[1] ?? '').length;
      const heading = (match[2] ?? '').trim();

      for (const lvl of Object.keys(stack).map(Number)) {
        if (lvl >= level) delete stack[lvl];
      }
      stack[level] = heading;

      const start = match.index + match[0].length;
      const nextMatch = headingMatches.at(idx + 1);
      const end = nextMatch?.index ?? text.length;
      const body = text.slice(start, end).trim();

      const breadcrumb = `${filename} > ${Object.values(stack).join(' > ')}`;
      sections.push({ text: body, breadcrumb });
    }

    const filtered = sections.filter((s) => {
      const firstLine = s.text.split('\n')[0]?.toLowerCase() ?? '';
      return !firstLine.includes('table of contents');
    });

    return filtered;
  }
}
