const fs = require('fs');

let code = fs.readFileSync('src/nar/lm/transformers-client.ts', 'utf8');

// Import CircuitBreaker
code = code.replace("import {createLogger} from '../logger/index.js';", "import {createLogger} from '../logger/index.js';\nimport {CircuitBreaker} from '../utils/circuit-breaker.js';");

// Replace consecutiveFailures logic with CircuitBreaker
code = code.replace("private consecutiveFailures = 0;\n    private readonly maxConsecutiveFailures = 3;", "private readonly circuitBreaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 300000 });");

const newGenerateText = `
    async generateText(prompt: string, options?: {signal?: AbortSignal; maxTokens?: number; temperature?: number}): Promise<string> {
        if (!this.available || this.circuitBreaker.getState() === 'open') return '';
        const startTime = Date.now();
        this.stats.totalCalls++;

        try {
            await this.ensureInitialized();
            await this.acquire(options?.signal);
            if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            if (!this.modelInstance) throw new Error('Transformers.js model not initialized');

            const result = await this.circuitBreaker.execute(async () => {
                return await Promise.race([
                    this.modelInstance!.doGenerate({
                        prompt: [{role: 'user', content: [{type: 'text', text: prompt}]}],
                        maxOutputTokens: options?.maxTokens ?? 128,
                        temperature: options?.temperature ?? 0.7,
                    }),
                    this.timeoutPromise(this.inferenceTimeoutMs, options?.signal),
                ]);
            });

            this.recordSuccess(Date.now() - startTime);
            return result.content?.[0]?.text ?? '';
        } catch (error) {
            const dur = Date.now() - startTime;
            const isAbort = (error as Error).name === 'AbortError';

            this.recordFailure(error as Error, dur);
            if (isAbort) throw error;

            if (this.circuitBreaker.getState() === 'open') {
                this.available = false;
                const err = error as Error & {stack?: string};
                logger.error('generateText failed, LM unavailable due to open circuit breaker', err);
            }

            return '';
        } finally {
            this.release();
        }
    }
`;

code = code.replace(/async generateText\([\s\S]*?finally \{\n\s*this\.release\(\);\n\s*\}\n\s*\}/m, newGenerateText.trim());

fs.writeFileSync('src/nar/lm/transformers-client.ts', code);
