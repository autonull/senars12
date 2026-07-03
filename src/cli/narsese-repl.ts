/**
 * SeNARS Narsese REPL — Direct symbolic interaction
 */

import { createInterface } from 'readline';
import { containsSubterm, SeNARSFactory, termParser } from '../../nar/src';
import { createLogger } from '../../nar/src/logger';
import { errMsg } from '../../nar/src/utils';
import { DEFAULT_NAR_CONFIG } from '../config';

const logger = createLogger({ scope: 'cli:narsese' });

async function main() {
  const nar = SeNARSFactory.createDefault(DEFAULT_NAR_CONFIG);

  logger.info(`SeNARS Narsese REPL mode started.`);
  logger.info(`Type Narsese inputs directly (e.g., '<robin --> bird>.'). Type 'exit' to quit.`);

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
      const clean = input.replace(/[?!.]+$/, '');
      if (input.endsWith('!')) {
        await nar.input(input, 'goal');
        console.log(`[GOAL ACCEPTED] ${input}`);
      } else if (input.endsWith('?')) {
        const parsed = termParser.parse(clean);
        const match = nar.getBeliefs().find(
          (b: {
            term: { toString: () => string };
            truth?: { f: number; c: number };
          }) => parsed ? containsSubterm(b.term as any, parsed) : false
        );
        console.log(
          match
            ? `[ANSWER] ${match.term.toString()} f=${match.truth?.f.toFixed(2)} c=${match.truth?.c.toFixed(2)}`
            : `[NO ANSWER] ${input}`
        );
      } else {
        await nar.input(clean, 'belief');
        const derived = await nar.run(5);
        console.log(`[BELIEF ACCEPTED] ${clean} | Derived ${derived} concepts`);
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
