export class ProviderUtils {
    static async standardGenerate(provider, prompt, options) {
        if (provider.generateText) {
            return provider.generateText(prompt, options);
        }
        if (provider.invoke) {
            const res = await provider.invoke(prompt, options);
            return res?.content ?? res;
        }
        if (provider.generate) {
            return provider.generate(prompt, options);
        }
        throw new Error('Provider missing generation method');
    }

    static async standardStream(provider, prompt, options) {
        if (provider.streamText) {
            return provider.streamText(prompt, options);
        }
        if (provider.stream) {
            return provider.stream(prompt, options);
        }
        throw new Error('Provider missing streaming method');
    }
}
