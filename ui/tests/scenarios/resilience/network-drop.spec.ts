import { expect, test } from '../../framework/fixtures/senars-app';

test('a dropped websocket connection self-heals @critical', async ({ page }) => {
  // Drop the first socket, then proxy every reconnect to the real server. The
  // client must recover without a user-triggered reconnect.
  let dropped = false;
  await page.routeWebSocket(/\/ws$/, (ws) => {
    if (!dropped) {
      dropped = true;
      ws.close();
      return;
    }
    ws.connectToServer();
  });

  await page.goto('/');
  await page.waitForFunction(
    () => (window as Record<string, unknown>).__testApi !== undefined,
    { timeout: 10000 }
  );

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          String(
            (
              (window as Record<string, unknown>).__testApi as {
                connection: { getState: () => string };
              }
            ).connection.getState()
          )
        ),
      { timeout: 15000 }
    )
    .toBe('connected');
  expect(dropped).toBe(true);
});