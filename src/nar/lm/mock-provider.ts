import {wrapLanguageModel, defaultSettingsMiddleware} from 'ai';

export function createMockLanguageModel(generateTextFn?: (prompt: string) => string | Promise<string>) {
    return wrapLanguageModel({
        model: {specificationVersion: 'v2', provider: 'mock', modelId: 'mock', supportedUrls: {},
            doGenerate: async (options: {prompt: unknown; responseFormat?: any; tools?: any}) => {
                const key = extractTextFromPrompt(options.prompt);
                let responseText = generateTextFn ? await generateTextFn(key) : 'Mock response: ' + key.slice(0, 50);

                if (options.responseFormat?.type === 'json') {
                    try {
                        responseText = JSON.stringify({result: 'mock', data: responseText.slice(0, 100)});
                    } catch {
                        responseText = '{"result": "mock"}';
                    }
                } else if (options.tools?.length) {
                    responseText = '{"tool": "mock", "args": {}}';
                }

                return {content: [{type: 'text', text: responseText}], finishReason: 'stop', usage: {inputTokens: 0, outputTokens: responseText.length, totalTokens: responseText.length}, warnings: []};
            },
            doStream: async (options: {prompt: unknown}) => {
                const key = extractTextFromPrompt(options.prompt);
                const responseText = generateTextFn ? await generateTextFn(key) : 'Mock response: ' + key.slice(0, 50);
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue({type: 'text-delta', id: '0', delta: responseText});
                        controller.enqueue({type: 'finish', finishReason: 'stop', usage: {inputTokens: 0, outputTokens: responseText.length, totalTokens: responseText.length}});
                        controller.close();
                    }
                });
                return {stream};
            },
        } as any,
        middleware: defaultSettingsMiddleware({settings: {}}),
        modelId: 'mock',
        providerId: 'mock',
    });
}

function extractTextFromPrompt(prompt: unknown): string {
    if (!prompt) return '';
    return (prompt as any[]).map((msg: any) => Array.isArray(msg.content) ? (msg.content as any[]).map((c: any) => c.type === 'text' ? c.text : '').join('') : '').join('');
}