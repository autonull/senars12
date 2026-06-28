import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('user can switch LLM provider and next response uses new provider', async ({ chat, config, testControl }) => {
  await config.open();
  await testControl.injectChatResponse('', 'Response from new provider');
  await sendAndReceiveMessage(chat, testControl, 'Hello');
});
