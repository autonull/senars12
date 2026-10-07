import { expect, test } from '../../framework/fixtures/senars-app';
import { openPanels, waitConnected } from '../../framework/utils/interactions';

test('agent markdown is rendered and sanitized @critical', async ({ page, testApi }) => {
  await openPanels(page, ['chat']);
  await testApi.ensureReady();
  await waitConnected(testApi);

  await page.evaluate(() => {
    const api = (window as Record<string, unknown>).__testApi as {
      store: { setState: (path: string, value: unknown) => void };
    };
    api.store.setState('chatMessages', [
      {
        id: 'agent-md',
        role: 'agent',
        content: '**bold** and `code` and <script>window.__xss = 1</script>',
        timestamp: 1_700_000_000_000,
        parentId: null,
        threadRootId: 'agent-md',
        supports: [],
        contradicts: [],
        derivesFrom: [],
      },
    ]);
  });

  const body = page.locator('chat-history-panel .msg-body.agent');
  await expect(body.locator('strong')).toHaveText('bold');
  await expect(body.locator('code')).toHaveText('code');
  await expect(body.locator('script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Record<string, unknown>).__xss)).toBeUndefined();
});