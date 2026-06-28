import { test, expect } from '../../framework/fixtures/senars-app';

test('user can send message using keyboard (Enter key)', async ({ chat, testControl }) => {
  await testControl.injectChatResponse('Processing... ', 'Keyboard response');

  await chat.sendMessage('Keyboard test');
  await chat.waitForResponse();

  const count = await chat.getMessageCount();
  expect(count).toBe(2);
});
