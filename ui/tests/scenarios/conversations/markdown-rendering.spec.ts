import { test, expect } from '../../framework/fixtures/senars-app';

test('agent responses render markdown correctly', async ({ chat, testControl, page }) => {
  const markdownResponse = `# Analysis

Here is a **bold** statement and a code block:

\`\`\`typescript
const x = 42;
console.log(x);
\`\`\`

And a [link](https://example.com).`;

  await testControl.injectChatResponse('Rendering markdown... ', markdownResponse);
  await chat.sendMessage('Render this');
  await chat.waitForResponse();

  const latest = await chat.getLatestMessage();
  expect(latest.content).toContain('Analysis');
  expect(latest.content).not.toContain('# Analysis');

  const codeBlock = page.locator('chat-console pre code').last();
  await expect(codeBlock).toBeVisible();

  const link = page.locator('chat-console a[href="https://example.com"]').last();
  await expect(link).toBeVisible();
});
