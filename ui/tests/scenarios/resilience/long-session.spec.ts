import { expect, test } from '../../framework/fixtures/senars-app';
import {
  chatMessageCount,
  openPanels,
  sendMessage,
  waitConnected,
} from '../../framework/utils/interactions';

test('many sequential messages accumulate without loss @critical', async ({ page, testApi }) => {
  await openPanels(page, ['chat']);
  await testApi.ensureReady();
  await waitConnected(testApi);

  for (let i = 0; i < 10; i++) await sendMessage(page, `message ${i}`);

  await expect.poll(() => chatMessageCount(testApi)).toBeGreaterThanOrEqual(10);
  await expect(page.locator('chat-history-panel .msg-body.user')).toHaveCount(10);
  expect(await testApi.getConnectionState()).toBe('connected');
});