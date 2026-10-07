import { expect, test } from '../../framework/fixtures/senars-app';
import { openPanels, waitConnected } from '../../framework/utils/interactions';

test('a streaming delta renders a live caret and clears on completion @critical', async ({
  page,
  testApi,
}) => {
  await openPanels(page, ['chat']);
  await testApi.ensureReady();
  await waitConnected(testApi);

  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as {
      store: { setState: (path: string, value: unknown) => void };
    };
    api.store.setState('streamingDelta', 'Answer so far');
  });

  const streaming = page.locator('chat-history-panel .message.streaming');
  await expect(streaming).toBeVisible();
  await expect(streaming.locator('.msg-body.agent')).toHaveText('Answer so far');

  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as {
      store: { setState: (path: string, value: unknown) => void };
    };
    api.store.setState('streamingDelta', '');
  });
  await expect(streaming).toHaveCount(0);
});