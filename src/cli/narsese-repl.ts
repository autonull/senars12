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
    if (input === 'exit' || input === 'quit') {
      rl.close();
      return;
    }

    if (input) {
      try {
        if (input.endsWith('!')) {
            await nar.input(input, 'goal');
            console.log(`[GOAL ACCEPTED] ${input}`);
        } else if (input.endsWith('?')) {
            const cleanQ = input.replace(/[?!.]+$/, '');
            const beliefs = nar.getBeliefs();
            const match = beliefs.find((b: any) => b.term.toString().includes(cleanQ.split('-->')[0] ?? cleanQ));
            if (match) {
                console.log(`[ANSWER] ${match.term.toString()} f=${match.truth?.f.toFixed(2)} c=${match.truth?.c.toFixed(2)}`);
            } else {
                console.log(`[NO ANSWER] ${input}`);
            }
        } else {
            const clean = input.replace(/[?!.]+$/, '');
            await nar.input(clean, 'belief');
            const derived = await nar.run(5);
            console.log(`[BELIEF ACCEPTED] ${clean} | Derived ${derived} concepts`);
        }
      } catch (err: any) {
        console.error(`Error processing input: ${err.message}`);
      }
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
