import { test, expect } from '../../framework/fixtures/senars-app';
import { sendAndReceiveMessage } from '../../framework/scenarios/conversation';

test('user can switch LLM provider and next response uses new provider', async ({ chat, config, ws }) => {
  await ws.injectConfigSchema({
    'llm.provider': {
      type: 'dropdown',
      label: 'LLM Provider',
      value: 'OpenAI',
      options: ['OpenAI', 'Anthropic', 'Ollama'],
    },
  });

  await config.open();
  await config.assertFieldExists('llm.provider');
  await config.setDropdown('llm.provider', 'Anthropic');

  await expect(async () => {
    const val = await config.getFieldValue('llm.provider');
    expect(val).toBe('Anthropic');
  }).toPass({ timeout: 2000 });

  ws.injectChatResponse('', 'Response from Anthropic Claude');
  await sendAndReceiveMessage(chat, ws, 'Hello', /anthropic/i);
});
