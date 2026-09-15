import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type GrammarName = 'narsese-term' | 'single-word';

const dir = dirname(fileURLToPath(import.meta.url));
const cache = new Map<GrammarName, string>();

/** Load a GBNF grammar by name (cached; grammars ship as sibling .gbnf files). */
export const loadGrammar = (name: GrammarName): string => {
  let g = cache.get(name);
  if (!g) {
    g = readFileSync(join(dir, `${name}.gbnf`), 'utf8');
    cache.set(name, g);
  }
  return g;
};
