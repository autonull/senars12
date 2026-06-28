import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('no memory leaks or performance degradation over multiple message exchanges', async ({ chat, graph, testControl }) => {
  for (let i = 0; i < 10; i++) {
    await sendAndReceiveMessage(chat, testControl, `Message ${i}`);

    const nodeCount = await graph.getNodeCount();
    expect(nodeCount).toBeLessThanOrEqual(300);
  }
});
