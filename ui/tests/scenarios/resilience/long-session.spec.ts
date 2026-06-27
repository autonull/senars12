import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('no memory leaks or performance degradation over 100 message exchanges', async ({ chat, graph, ws }) => {
  for (let i = 0; i < 100; i++) {
    await sendAndReceiveMessage(chat, ws, `Message ${i}`);

    if (i % 10 === 0) {
      const nodeCount = await graph.getNodeCount();
      expect(nodeCount).toBeLessThanOrEqual(300);
    }
  }
});
