import type { ChatOptions, ChatStreamEvent, CognitiveEventSource } from '@senars/core';
import { errMsg } from '@senars/nar/utils';
import { nanoid } from 'nanoid';
import type { IncomingFromServer } from '@senars/core/protocol';
import { consumePendingChatResponse } from './gateway.js';

const STREAM_DELAY_MS = 200;

function renderHtml(text: string): string {
  return `<div class="graph-message msg-agent">${text}</div>`;
}

export async function onChat(
  content: string,
  send: (msg: IncomingFromServer) => void,
  source: CognitiveEventSource
): Promise<void> {
  const pending = consumePendingChatResponse();
  if (pending) return replayPending(pending, send);

  const messageId = nanoid();

  if (!source.chat) {
    send({
      type: 'chat.agent.complete',
      content: 'Chat not available for this agent',
      html: renderHtml('Chat not available for this agent'),
      messageId,
    });
    return;
  }

  try {
    const chatResult = source.chat(content, { stream: true });
    if (Symbol.asyncIterator in chatResult) {
      for await (const event of chatResult as AsyncGenerator<ChatStreamEvent, string>) {
        if (event.kind === 'text-delta')
          send({ type: 'chat.agent.stream', delta: event.text ?? '' });
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
    } else {
      const result = await chatResult;
      send({
        type: 'chat.agent.complete',
        content: result,
        html: renderHtml(result),
        messageId,
      });
    }
  } catch (e) {
    const errText = errMsg(e);
    send({
      type: 'chat.agent.complete',
      content: `Error: ${errText}`,
      html: renderHtml(`Error: ${errText}`),
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
