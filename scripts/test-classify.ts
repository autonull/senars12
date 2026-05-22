import {classify} from '../src/agent/pipeline/stages/InputClassifier.js';
import {DEFAULT_BOT_CONFIG} from '../src/agent/BotContext.js';
import {ConversationStateManager} from '../src/agent/ConversationStateManager.js';

const tests = [
  'All birds can fly',
  'Tweety is a bird',
  'Can Tweety fly?',
  'Cats are mammals',
  'What are cats?',
  '<bird --> can-fly>.',
  '(Tweety --> bird).',
];

const stateManager = new ConversationStateManager({} as any);

for (const test of tests) {
  const conv = stateManager.getOrCreate('test');
  const result = classify(test, conv, DEFAULT_BOT_CONFIG);
  console.log(`"${test}" → ${result.primary} (${result.confidence.toFixed(2)})`);
}
