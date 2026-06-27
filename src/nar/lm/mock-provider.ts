import type {LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2Content, LanguageModelV2FinishReason, LanguageModelV2StreamPart, LanguageModelV2TextPart} from '@ai-sdk/provider';

export function createMockLanguageModel(): LanguageModelV2 {
    return {
        specificationVersion: 'v2',
        provider: 'mock',
        modelId: 'mock',
        supportedUrls: {},
        
        doGenerate: async (options: LanguageModelV2CallOptions) => {
            const key = extractTextFromPrompt(options.prompt);
            const responseText = 'Mock response for: ' + key.slice(0, 50);
            const content: LanguageModelV2Content[] = [{type: 'text', text: responseText}];
            return {
                content,
                finishReason: 'stop' as LanguageModelV2FinishReason,
                usage: {inputTokens: 0, outputTokens: responseText.length, totalTokens: responseText.length},
                warnings: [],
            };
        },
        
        doStream: async (options: LanguageModelV2CallOptions) => {
            const key = extractTextFromPrompt(options.prompt);
            const responseText = 'Mock response for: ' + key.slice(0, 50);
            const stream = new ReadableStream<LanguageModelV2StreamPart>({
                start(controller) {
                    controller.enqueue({type: 'text-delta', id: '0', delta: responseText});
                    controller.enqueue({type: 'finish', finishReason: 'stop', usage: {
                        inputTokens: 0,
                        outputTokens: responseText.length,
                        totalTokens: responseText.length
                    }});
                    controller.close();
                }
            });
            return {stream};
        },
    };
}

function extractTextFromPrompt(prompt: LanguageModelV2CallOptions['prompt']): string {
    if (!prompt) return '';
    return prompt.map(msg => 
        Array.isArray(msg.content)
            ? msg.content.map(c => c.type === 'text' ? (c as LanguageModelV2TextPart).text : '').join('')
            : ''
    ).join('');
}