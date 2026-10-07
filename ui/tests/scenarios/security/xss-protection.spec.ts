import { expect, test } from '../../framework/fixtures/senars-app';
import { openPanels, waitConnected } from '../../framework/utils/interactions';

test('untrusted content is sanitized before rendering @critical', async ({ page, testApi }) => {
  await openPanels(page, ['chat']);
  await testApi.ensureReady();
  await waitConnected(testApi);

  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as {
      store: { setState: (path: string, value: unknown) => void };
    };
    api.store.setState('chatMessages', [
      {
        id: 'agent-xss',
        role: 'agent',
        content: '<img src=x onerror="window.__xss = 1">',
        timestamp: 1_700_000_000_000,
        parentId: null,
        threadRootId: 'agent-xss',
        supports: [],
        contradicts: [],
        derivesFrom: [],
      },
      {
        id: 'user-xss',
        role: 'user',
        content: '<script>window.__xss = 1</script>',
        timestamp: 1_700_000_000_001,
        parentId: null,
        threadRootId: 'user-xss',
        supports: [],
        contradicts: [],
        derivesFrom: [],
      },
    ]);
  });

  const panel = page.locator('chat-history-panel');
  await expect(panel.locator('.msg-body')).toHaveCount(2);
  await expect(panel.locator('script')).toHaveCount(0);
  await expect(panel.locator('.msg-body.agent img[onerror]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Record<string, unknown>).__xss)).toBeUndefined();
});