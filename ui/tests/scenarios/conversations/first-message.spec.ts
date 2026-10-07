import { expect, test } from '../../framework/fixtures/senars-app';
import {
  chatMessageCount,
  openPanels,
  sendMessage,
  waitConnected,
} from '../../framework/utils/interactions';

test('a first message is rendered in the conversation @critical', async ({ page, testApi }) => {
  await openPanels(page, ['chat']);
  await testApi.ensureReady();
  await waitConnected(testApi);

  await sendMessage(page, 'What do you know?');
  await expect.poll(() => chatMessageCount(testApi)).toBeGreaterThan(0);

  await expect(page.locator('chat-history-panel .msg-body.user')).toContainText('What do you know?');
});