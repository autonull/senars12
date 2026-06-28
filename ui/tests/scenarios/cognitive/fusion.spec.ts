import { test, expect } from '../../framework/fixtures/senars-app';
import { seedGraph } from '../../framework/scenarios/reasoning';

test.describe('Chat↔Graph Fusion', () => {
  test('seeded NAR concepts appear as graph nodes', async ({ graph, testControl }) => {
    await testControl.seedGraph([
      { term: 'bird', f: 0.9, c: 0.9 },
      { term: 'fly', f: 0.8, c: 0.85 },
    ]);
    await testControl.injectDerivation('bird', 0.85, 0.9);
    await graph.waitForNode('bird');

    const data = await graph.getNodeData('bird');
    expect(data).not.toBeNull();
    expect(data.priority).toBeGreaterThan(0);
  });

  test('chat message click updates selectedMessageId and focusTerm', async ({ chat, testControl, testApi, page }) => {
    await testControl.injectChatResponse('Processing...', 'Paris is the capital of France.');
    await chat.sendMessage('What is the capital?');
    await chat.waitForResponse();

    await page.locator('chat-console').locator('[data-testid="message"]').last().click();

    await expect(async () => {
      expect(await testApi.getStoreState('selectedMessageId')).not.toBeNull();
    }).toPass({ timeout: 3000 });

    expect(await testApi.getStoreState('focusTerm')).not.toBeNull();
  });

  test('graph node click sets selectedMessageId', async ({ graph, testControl, testApi }) => {
    await seedGraph(testControl, graph, [
      { term: 'penguin', f: 0.9, c: 0.9 },
      { term: 'bird', f: 0.95, c: 0.95 },
    ]);
    await graph.waitForNode('penguin');

    await graph.clickNode('penguin');

    expect(await testApi.getStoreState('selectedMessageId')).toBe('penguin');
  });

  test('concept thread appears on message click', async ({ chat, testControl, page }) => {
    await testControl.injectChatResponse('Thinking...', 'Quantum mechanics describes nature at the smallest scales.');
    await chat.sendMessage('Explain quantum');
    await chat.waitForResponse();

    await page.locator('chat-console').locator('[data-testid="message"]').last().click();

    await expect(page.locator('concept-thread')).toBeVisible({ timeout: 3000 });
  });

  test('graph updates when new NAR derivations arrive', async ({ graph, testControl }) => {
    await testControl.seedGraph([
      { term: 'animal', f: 0.95, c: 0.95 },
    ]);
    await testControl.injectDerivation('animal', 0.9);
    await graph.waitForNode('animal');

    const initialCount = await graph.getNodeCount();

    await testControl.injectDerivation('mammal', 0.85, 0.9);
    await graph.waitForNode('mammal');

    expect(await graph.getNodeCount()).toBeGreaterThanOrEqual(initialCount);

    const mammalData = await graph.getNodeData('mammal');
    expect(mammalData).not.toBeNull();
    expect(mammalData.priority).toBeGreaterThan(0);
  });
});
