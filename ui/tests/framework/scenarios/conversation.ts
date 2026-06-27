import { expect } from '@playwright/test';
import { ChatConsole } from '../components/chat.console';
import { WsInterceptor } from '../fixtures/ws-interceptor';

export async function sendAndReceiveMessage(
  chat: ChatConsole,
  ws: WsInterceptor,
  userMessage: string,
  expectedResponsePattern?: RegExp
) {
  ws.injectChatResponse(
    `Processing "${userMessage}"... `,
    `Processed: ${userMessage}. Analysis complete.`
  );

  const initialCount = await chat.getMessageCount();
  await chat.sendMessage(userMessage);

  await expect(async () => {
    const count = await chat.getMessageCount();
    expect(count).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 5000 });

  await chat.waitForResponse();

  const latest = await chat.getLatestMessage();
  expect(latest.role).toBe('agent');

  if (expectedResponsePattern) {
    expect(latest.content).toMatch(expectedResponsePattern);
  }

  return latest;
}

export async function establishConversation(
  chat: ChatConsole,
  ws: WsInterceptor,
  turns: number = 3
) {
  const messages = [
    'What is the capital of France?',
    'Tell me more about its history.',
    'What are some famous landmarks there?',
  ];

  for (let i = 0; i < Math.min(turns, messages.length); i++) {
    await sendAndReceiveMessage(chat, ws, messages[i]!);
  }
}
