import type { Agent } from '../../../src/agent/types.js';
import type { IncomingFromServer } from '../shared/protocol.js';
import { consumePendingChatResponse } from './gateway.js';

const STREAM_DELAY_MS = 200;

export async function onChat(
  content: string,
  send: (msg: IncomingFromServer) => void,
  agent: Agent,
): Promise<void> {
  const pending = consumePendingChatResponse();
  if (pending) return replayPending(pending, send);

  try {
    for await (const event of agent.chat(content, { stream: true })) {
      if (event.kind === 'text-delta') send({ type: 'chat.agent.stream', delta: event.text ?? '' });
      else if (event.kind === 'finish') send({ type: 'chat.agent.complete', content: event.text ?? '' });
      else if (event.kind === 'error') send({ type: 'chat.agent.complete', content: `Error: ${event.error}` });
    }
  } catch (e) {
    send({ type: 'chat.agent.complete', content: `Error: ${e instanceof Error ? e.message : String(e)}` });
  }
}

function replayPending(pending: { stream: string; complete: string }, send: (msg: IncomingFromServer) => void): Promise<void> {
  return new Promise((resolve) => {
    if (pending.stream) send({ type: 'chat.agent.stream', delta: pending.stream });
    setTimeout(() => {
      if (pending.complete) send({ type: 'chat.agent.complete', content: pending.complete });
      resolve();
    }, STREAM_DELAY_MS);
  });
}
