import { dispatchNarseseIntent } from './narsese-intent.js';

export type InputType =
  | 'command'
  | 'narsese-belief'
  | 'narsese-question'
  | 'nl-explicit'
  | 'nl-implicit';

export function classify(input: string): InputType {
  const t = input.trim();
  if (t.startsWith('.')) return 'command';
  if (/^".*"$/.test(t)) return 'nl-explicit';
  const intent = dispatchNarseseIntent(t);
  if (intent) return intent.kind === 'question' ? 'narsese-question' : 'narsese-belief';
  return 'nl-implicit';
}
