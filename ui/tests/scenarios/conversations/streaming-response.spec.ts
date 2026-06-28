import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('agent response streams text incrementally', async ({ chat, testControl }) => {
  await testControl.injectChatResponse('Here is a streaming response... ', 'Here is a streaming response... and it is complete.');

  await chat.sendMessage('Tell me something');

  await chat.assertStreaming();

  await chat.waitForResponse();
  await chat.assertNotStreaming();

  const latest = await chat.getLatestMessage();
  expect(latest.role).toBe('agent');
  expect(latest.content).toContain('streaming');
});
