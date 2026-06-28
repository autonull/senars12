import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';
import { simulateNetworkDrop, waitForReconnection } from '../../framework/scenarios/network';

test('UI reconnects and reconciles state after network drop', async ({ chat, graph, page, testApi, testControl }) => {
  await sendAndReceiveMessage(chat, testControl, 'Hello');
  const messageCountBefore = await chat.getMessageCount();
  const nodeCountBefore = await graph.getNodeCount();

  await simulateNetworkDrop(page, 3000);

  await waitForReconnection(testApi);

  await expect(async () => {
    const messageCountAfter = await chat.getMessageCount();
    const nodeCountAfter = await graph.getNodeCount();
    expect(messageCountAfter).toBe(messageCountBefore);
    expect(nodeCountAfter).toBe(nodeCountBefore);
  }).toPass({ timeout: 5000 });
});
