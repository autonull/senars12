/**
 * SeNARS Narsese REPL — Direct symbolic interaction
 */

import { createInterface } from 'readline';
import { containsSubterm, SeNARSFactory, termParser } from '../../nar/src';
import { ingressQueries } from '../../nar/src/lm/system-one/head-specs.js';
import { createLogger } from '../../nar/src/logger';
import { errMsg } from '../../nar/src/utils';
import { DEFAULT_NAR_CONFIG } from '../config';

const logger = createLogger({ scope: 'cli:narsese' });

/** I3/X11: full 6-head judgment distribution for arbitrary text. */
async function judge(nar: ReturnType<typeof SeNARSFactory.createDefault>, text: string): Promise<string> {
  const cache = nar.getSystemOneEmbeddingCache();
  const manifold = nar.getSystemOneManifold();
  if (!cache || !manifold) return 'System One is not enabled — :judge requires a live manifold.';
  const pointer = await cache.write(text);
  const results = await manifold.judgeBatch(pointer as never, ingressQueries(), {
    maxCycles: 10,
    maxDepth: 5,
    maxMemoryOps: 100,
    maxLMCalls: 10,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  } as never);
  return results
    .map((p) => {
      const detail =
        p.kind === 'classify' ? `${p.abstained ? 'abstain' : p.top.option}@${p.top.p.toFixed(2)}` : `score=${p.abstained ? 'abstain' : p.score.toFixed(2)}`;
      return `  ${p.queryId}: ${detail} (tier ${p.tier}, ece ${p.calibration?.ece?.toFixed(3) ?? '—'})`;
    })
    .join('\n');
}

async function main() {
  const nar = SeNARSFactory.createDefault(DEFAULT_NAR_CONFIG);

  logger.info(`SeNARS Narsese REPL mode started.`);
  logger.info(
    `Type Narsese inputs directly (e.g., '<robin --> bird>.') or natural language. Commands: :judge <text>, :health, :spend, exit.`
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'narsese> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (/^(?:exit|quit)$/i.test(input)) return rl.close();
    if (!input) return rl.prompt();

    try {
      if (input.startsWith(':judge ')) {
        console.log(await judge(nar, input.slice(7)));
      } else if (input === ':health') {
        const manifold = nar.getSystemOneManifold();
        console.log(manifold && 'health' in manifold ? JSON.stringify(manifold.health()) : 'System One not enabled');
      } else if (input === ':spend') {
        const spend = nar.getLMClient()?.getSpend();
        console.log(Object.keys(spend ?? {}).length ? JSON.stringify(spend, null, 2) : 'No LM spend recorded.');
      } else if (input.endsWith('!')) {
        await nar.input(input, 'goal');
        console.log(`[GOAL ACCEPTED] ${input}`);
      } else if (input.endsWith('?')) {
        const clean = input.replace(/[?!.]+$/, '');
        const parsed = termParser.parse(clean);
        const match = nar
          .getBeliefs()
          .find((b: { term: { toString: () => string }; truth?: { f: number; c: number } }) =>
            parsed ? containsSubterm(b.term as any, parsed) : false
          );
        console.log(
          match
            ? `[ANSWER] ${match.term.toString()} f=${match.truth?.f.toFixed(2)} c=${match.truth?.c.toFixed(2)}`
            : `[NO ANSWER] ${input}`
        );
      } else {
        const clean = input.replace(/[?!.]+$/, '');
        await nar.input(clean, 'belief');
        const derived = await nar.run(5);
        console.log(`[ACCEPTED] ${clean} | Derived ${derived} concepts`);
      }
    } catch (err) {
      console.error(`Error processing input: ${errMsg(err)}`);
    }
    rl.prompt();
  }).on('close', () => {
    console.log('Exiting Narsese REPL.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
