/**
 * Session retrospective — analyze a captured dialogue session.
 */

import type { BotRuntime } from '../context';

/** Run a retrospective on a session. */
export async function runSessionRetrospective(
  rt: BotRuntime,
  sessionId: string
): Promise<string> {
  const { dialogue, wired } = rt;
  const { episodicMemory } = wired;

  // Get episodes for this session
  const episodes = await episodicMemory.getEpisodes({
    type: 'dialogue',
    limit: 1000,
  });

  const sessionEpisodes = episodes.filter(
    (e) => (e.metadata as { sessionId?: string }).sessionId === sessionId
  );

  if (sessionEpisodes.length === 0) {
    return `No dialogue episodes found for session ${sessionId}`;
  }

  // Analyze the session
  const turns = sessionEpisodes.length;
  const userTurns = sessionEpisodes.filter((e) => (e.metadata as { role?: string }).role === 'user').length;
  const agentTurns = sessionEpisodes.filter((e) => (e.metadata as { role?: string }).role === 'assistant').length;

  let totalChars = 0;
  let totalTokens = 0;
  for (const ep of sessionEpisodes) {
    const text = (ep.metadata as { text?: string }).text ?? '';
    totalChars += text.length;
    totalTokens += text.split(/\s+/).length;
  }

  // Get reactions/grading if available
  const reactions = sessionEpisodes.filter((e) => (e.metadata as { reaction?: string }).reaction);
  const corrections = reactions.filter((e) => (e.metadata as { reaction?: string }).reaction === 'correct');
  const positive = reactions.filter((e) => (e.metadata as { reaction?: string }).reaction === 'good');
  const negative = reactions.filter((e) => (e.metadata as { reaction?: string }).reaction === 'bad');

  // Build report
  const lines = [
    `Retrospective: ${sessionId}`,
    `═══════════════════════════════════`,
    `Turns: ${turns} (user: ${userTurns}, agent: ${agentTurns})`,
    `Characters: ${totalChars}`,
    `Est. tokens: ${totalTokens}`,
    '',
    'Reactions:',
    `  Good: ${positive.length}`,
    `  Bad: ${negative.length}`,
    `  Corrections: ${corrections.length}`,
    '',
  ];

  if (corrections.length > 0) {
    lines.push('Corrections:');
    for (const c of corrections.slice(-5)) {
      const text = (c.metadata as { text?: string }).text ?? '';
      lines.push(`  - ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`);
    }
  }

  return lines.join('\n');
}