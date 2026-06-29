import { nanoid } from 'nanoid';
import type { Agent } from '../../../agent/src/types.js';
import type { IncomingFromServer } from '../shared/protocol.js';
import { consumePendingChatResponse } from './gateway.js';

const STREAM_DELAY_MS = 200;

function renderHtml(text: string): string {
  return `<div class="graph-message msg-agent">${text}</div>`;
}

export async function onChat(
  content: string,
  send: (msg: IncomingFromServer) => void,
  agent: Agent
): Promise<void> {
  const pending = consumePendingChatResponse();
  if (pending) return replayPending(pending, send);

  const messageId = nanoid();

  try {
    for await (const event of agent.chat(content, { stream: true })) {
      if (event.kind === 'text-delta') send({ type: 'chat.agent.stream', delta: event.text ?? '' });
      else if (event.kind === 'finish')
        send({
          type: 'chat.agent.complete',
          content: event.text ?? '',
          html: renderHtml(event.text ?? ''),
          messageId,
        });
      else if (event.kind === 'error')
        send({
          type: 'chat.agent.complete',
          content: `Error: ${event.error}`,
          html: renderHtml(`Error: ${event.error}`),
          messageId,
        });
    }
  } catch (e) {
    send({
      type: 'chat.agent.complete',
      content: `Error: ${e instanceof Error ? e.message : String(e)}`,
      html: renderHtml(`Error: ${e instanceof Error ? e.message : String(e)}`),
      messageId,
    });
  }
}

function replayPending(
  pending: { stream: string; complete: string },
  send: (msg: IncomingFromServer) => void
): Promise<void> {
  return new Promise((resolve) => {
    if (pending.stream) send({ type: 'chat.agent.stream', delta: pending.stream });
    setTimeout(() => {
      if (pending.complete)
        send({
          type: 'chat.agent.complete',
          content: pending.complete,
          html: renderHtml(pending.complete),
          messageId: nanoid(),
        });
      resolve();
    }, STREAM_DELAY_MS);
  });
}
