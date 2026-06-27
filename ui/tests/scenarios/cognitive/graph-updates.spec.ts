import { test, expect } from '../../framework/fixtures/senars-app';
import { seedGraph, triggerDerivation } from '../../framework/scenarios/reasoning';

test('belief graph updates when NARS derives new conclusions', async ({ graph, ws }) => {
  await seedGraph(ws, graph, [
    { id: 'bird', priority: 0.9, confidence: 0.9 },
    { id: 'fly', priority: 0.8, confidence: 0.85 },
    { id: 'animal', priority: 0.95, confidence: 0.95 },
  ]);

  const initialCount = await graph.getNodeCount();
  expect(initialCount).toBe(3);

  await triggerDerivation(ws, graph, 'flying-animal', 0.85);

  const newCount = await graph.getNodeCount();
  expect(newCount).toBe(4);

  const data = await graph.getNodeData('flying-animal');
  expect(data.priority).toBe(0.85);
});
