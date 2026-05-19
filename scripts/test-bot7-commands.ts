/**
 * Automated test script for BOT7 REPL experimentation
 * Run with: pnpm tsx scripts/test-bot7-commands.ts
 */

import {SeNARSFactory} from '../src/nar/index.js';
import {createSeNARSRegistry} from '../src/nar/lm/providers.js';
import {DEFAULT_NAR_CONFIG} from '../src/config/defaults.js';
import {BotProfile} from '../src/agent/index.js';
import {EpisodicMemory} from '../src/nar/memory/EpisodicMemory.js';
import {createREPLCommands} from '../src/cli/commands.js';
import {Bot} from '../src/agent/index.js';

async function testCommands() {
  console.log('BOT7 REPL Commands Test Suite\n');
  console.log('=' .repeat(50));
  
  const registry = createSeNARSRegistry();
  const nar = SeNARSFactory.createDefault({
    ...DEFAULT_NAR_CONFIG,
    providerRegistry: registry,
  });

  const profile = new BotProfile();
  const episodicMemory = new EpisodicMemory();

  const bot = new Bot({
    profile,
    nar,
    episodicMemory,
    config: {
      streaming: {enabled: false, showReasoningSteps: true, showToolCalls: true},
    },
  });

  await bot.start();
  const commands = createREPLCommands(bot, nar);

  console.log('\n1. Testing /help command');
  console.log('-' .repeat(50));
  let result = await commands.execute('/help');
  console.log(result.output);

  console.log('\n2. Testing /depth command');
  console.log('-' .repeat(50));
  result = await commands.execute('/depth 5');
  console.log(result.output);

  console.log('\n3. Testing basic belief input');
  console.log('-' .repeat(50));
  result = await commands.execute('<cat --> animal>.');
  console.log(result.success ? 'Belief processed' : 'Command not recognized (expected for beliefs)');

  console.log('\n4. Testing /beliefs command');
  console.log('-' .repeat(50));
  result = await commands.execute('/beliefs');
  console.log(result.output);

  console.log('\n5. Testing /concepts command');
  console.log('-' .repeat(50));
  result = await commands.execute('/concepts');
  console.log(result.output);

  console.log('\n6. Testing /run command (experiment)');
  console.log('-' .repeat(50));
  result = await commands.execute('/run 3 <dog --> animal>.');
  console.log(result.output);

  console.log('\n7. Testing /diagnostic command');
  console.log('-' .repeat(50));
  result = await commands.execute('/diagnostic <bird --> animal>.');
  console.log(result.output);

  console.log('\n8. Testing /mode command');
  console.log('-' .repeat(50));
  result = await commands.execute('/mode');
  console.log(result.output);

  console.log('\n9. Testing /reset command');
  console.log('-' .repeat(50));
  result = await commands.execute('/reset');
  console.log(result.output);

  console.log('\n10. Testing /history command');
  console.log('-' .repeat(50));
  result = await commands.execute('/history');
  console.log(result.output || 'No history (expected)');

  console.log('\n11. Testing /trace command');
  console.log('-' .repeat(50));
  result = await commands.execute('/trace (cat --> animal)');
  console.log(result.output || 'No trace (expected for new term)');

  console.log('\n12. Testing /explain command');
  console.log('-' .repeat(50));
  result = await commands.execute('/explain (cat --> animal)');
  console.log(result.output || 'No explanation (expected)');

  console.log('\n' + '=' .repeat(50));
  console.log('Test suite completed');
  
  await bot.stop();
  process.exit(0);
}

testCommands().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
