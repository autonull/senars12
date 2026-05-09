export class Ollama {
    constructor(_config?: { host?: string }) {
        // Mock constructor
    }

    async generate(params: { model: string; prompt: string; options?: any }) {
        return {
            response: `Mock response for: ${params.prompt}`,
            model: params.model,
        };
    }
}

export default Ollama;
