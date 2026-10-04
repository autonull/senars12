import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOrInsert, LruCache } from '@senars/util';

export type GrammarName = 'narsese-term' | 'single-word';

const GRAMMAR_CACHE_MAX = 16;

const dir = dirname(fileURLToPath(import.meta.url));
const cache = new LruCache<GrammarName, string>(GRAMMAR_CACHE_MAX);

/** Load a GBNF grammar by name (cached; grammars ship as sibling .gbnf files). */
export const loadGrammar = (name: GrammarName): string =>
  getOrInsert(cache, name, () => readFileSync(join(dir, `${name}.gbnf`), 'utf8'));
