import { jest } from '@jest/globals';
import { WebLLMProvider } from '@senars/core';

const mockEngine = {
  chat: { completions: { create: jest.fn() } },
  unload: jest.fn(),
};

const mockCreateMLCEngine = jest.fn().mockResolvedValue(mockEngine);

jest.mock('@mlc-ai/web-llm', () => ({ CreateMLCEngine: mockCreateMLCEngine }));

describe('WebLLMProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new WebLLMProvider({ modelName: 'test-model' });
  });

  afterEach(async () => {
    if (provider) await provider.destroy();
    jest.clearAllMocks();
  });

  test('should initialize and load model', async () => {
    mockEngine.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'World' } }],
    });
    const result = await provider.generateText('Hello');
    expect(mockCreateMLCEngine).toHaveBeenCalledWith('test-model', expect.any(Object));
    expect(result).toBe('World');
  });

  test('should generate text with tools', async () => {
    mockEngine.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Tool result' } }],
    });
    const result = await provider.generateText('Use tool', { tools: [{ name: 'test' }] });
    expect(result).toBe('Tool result');
  });

  test('should stream text', async () => {
    mockEngine.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Streamed' } }],
    });
    const onToken = jest.fn();
    const result = await provider.generateText('Stream', { onToken });
    expect(result).toBe('Streamed');
  });
});
