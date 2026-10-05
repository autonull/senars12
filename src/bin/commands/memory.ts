/** Episodic + concept memory commands (`.consolidate`, `.memory-*`, `.recall`). */

import { errMsg, finiteOr, incrementCount, readJsonlAsync, writeJsonl } from '@senars/util';
import { attempted, cmd } from '../../cli/commands.js';
import { flagsOf, tokenize } from './args.js';
import type { BotRuntime } from './context.js';

interface EpisodeRow {
  type?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export const memoryCommandsFor = (rt: BotRuntime) => [
  cmd('consolidate', 'Run memory consolidation', async (args = '') => {
    const [limit, relevance, dedupe] = tokenize(args).map(Number);
    return attempted('consolidate ', async () => {
      const r = await rt.wired.consolidateMemory({
        ...(Number.isFinite(limit) ? { limit } : {}),
        ...(Number.isFinite(relevance) ? { relevanceThreshold: relevance } : {}),
        ...(Number.isFinite(dedupe) ? { dedupeThreshold: dedupe } : {}),
      });
      return `Consolidated: promoted=${r.promoted.length} deduped=${r.deduped ?? 0} scanned=${r.considered ?? 0}`;
    });
  }),
  cmd('memory-stats', 'Episodic memory stats', async () => {
    const eps = await rt.wired.episodicMemory.getEpisodes({ limit: 100000 });
    const byType = new Map<string, number>();
    for (const e of eps) incrementCount(byType, e.type, 1);
    return `episodes=${eps.length} path=${rt.wired.episodicMemory.basePath}\n${[...byType].map(([t, n]) => `  ${t}: ${n}`).join('\n') || '  (empty)'}`;
  }),
  cmd('memory-clear', 'Clear episodic memory (requires --yes)', async (args = '') => {
    if (!flagsOf(args).has('--yes')) return 'Destructive. Re-run as .memory-clear --yes to confirm';
    await rt.wired.episodicMemory.clear();
    return 'Episodic memory cleared';
  }),
  cmd('memory-export', 'Export episodes to JSONL', async (args = '') => {
    const path = args.trim() || '.cache/episodes-export.jsonl';
    const eps = await rt.wired.episodicMemory.getEpisodes({ limit: 100000 });
    await writeJsonl(path, eps);
    return `Exported ${eps.length} episodes to ${path}`;
  }),
  cmd('memory-import', 'Import episodes from JSONL', async (args = '') => {
    const path = args.trim();
    if (!path) return 'Usage: .memory-import <path>';
    return attempted('import ', async () => {
      const { rows } = await readJsonlAsync<EpisodeRow>(path, (value) => value as EpisodeRow);
      let n = 0;
      for (const e of rows) {
        if (typeof e.content === 'string') {
          await rt.wired.episodicMemory.log(
            (e.type as never) ?? 'input',
            e.content,
            e.metadata ?? {}
          );
          n++;
        }
      }
      return `Imported ${n}/${rows.length} episodes`;
    });
  }),
  cmd('recall', 'Cross-memory recall: <term> [n]', async (args = '') => {
    const [term, nRaw] = tokenize(args);
    if (!term) return 'Usage: .recall <term> [n]';
    const results = await rt.memoryQuery
      .search({ concept: term, limit: finiteOr(nRaw, 8) })
      .catch((e: unknown) => {
        throw new Error(`recall failed: ${errMsg(e)}`);
      });
    if (results.length === 0) return `No memory results for “${term}”.`;
    return results
      .map((r) => {
        const score = r.score.toFixed(3);
        return r.source === 'episode'
          ? `  [ep] ${score} ${r.episode?.type}:${String(r.episode?.content).slice(0, 60)}`
          : `  [concept] ${score} ${r.concept?.term.toString().slice(0, 60)}`;
      })
      .join('\n');
  }),
];
