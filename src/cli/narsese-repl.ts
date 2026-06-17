/**
 * SeNARS Narsese REPL — Direct symbolic interaction
 */

import {createInterface} from 'readline';
import {SeNARSFactory} from '../nar/index.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {createLogger} from '../nar/logger/index.js';

const logger = createLogger({scope: 'cli:narsese'});

async function main() {
  const nar = SeNARSFactory.createDefault(DEFAULT_NAR_CONFIG);

  logger.info(`SeNARS Narsese REPL mode started.`);
  logger.info(`Type Narsese inputs directly (e.g., '<robin --> bird>.'). Type 'exit' to quit.`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'narsese> '
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
          const match = nar.getBeliefs().find((b: { term: { toString: () => string }, truth?: { f: number, c: number } }) => b.term.toString().includes(clean.split('-->')[0] ?? clean));
          console.log(match ? `[ANSWER] ${match.term.toString()} f=${match.truth?.f.toFixed(2)} c=${match.truth?.c.toFixed(2)}` : `[NO ANSWER] ${input}`);
      } else {
          await nar.input(clean, 'belief');
          const derived = await nar.run(5);
          console.log(`[BELIEF ACCEPTED] ${clean} | Derived ${derived} concepts`);
      }
    } catch (err) {
      console.error(`Error processing input: ${err instanceof Error ? err.message : String(err)}`);
    }
    rl.prompt();
  }).on('close', () => {
    console.log('Exiting Narsese REPL.');
    process.exit(0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
