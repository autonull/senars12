import { expect } from '@playwright/test';
import type { ChatConsole } from '../components/chat.console';
import type { TestControl } from '../utils/test-control';

export async function sendAndReceiveMessage(
  chat: ChatConsole,
  testControl: TestControl,
  userMessage: string,
  expectedResponsePattern?: RegExp
) {
  await testControl.injectChatResponse(
    `Processing "${userMessage}"... `,
    `Processed: ${userMessage}. Analysis complete.`
  );

  const initialCount = await chat.getMessageCount();
  await chat.sendMessage(userMessage);

  // Wait for agent response by polling for message count increase and agent role
  await expect(async () => {
    const count = await chat.getMessageCount();
    expect(count).toBeGreaterThan(initialCount);
    const latest = await chat.getLatestMessage();
    expect(latest.role).toBe('agent');
  }).toPass({ timeout: 10000 });

  await chat.waitForResponse();

  const latest = await chat.getLatestMessage();
  expect(latest.role).toBe('agent');

  if (expectedResponsePattern) {
    expect(latest.content).toMatch(expectedResponsePattern);
  }

  return latest;
}


