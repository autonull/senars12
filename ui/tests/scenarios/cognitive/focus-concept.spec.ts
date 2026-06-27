import { test, expect } from '../../framework/fixtures/senars-app';
import { seedGraph } from '../../framework/scenarios/reasoning';

test('clicking a node in the graph focuses it and recenters the subgraph', async ({ graph, ws, testApi }) => {
  await seedGraph(ws, graph, [
    { id: 'bird', priority: 0.9, confidence: 0.9 },
    { id: 'fly', priority: 0.8, confidence: 0.85 },
    { id: 'animal', priority: 0.95, confidence: 0.95 },
  ]);

  await graph.clickNode('bird');

  await expect(async () => {
    const terms = await testApi.getWorkingMemoryTerms();
    expect(terms).toContain('bird');
  }).toPass({ timeout: 2000 });
});
