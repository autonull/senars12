import type {LanguageModel} from 'ai';
import {generateObject} from 'ai';
import type {SeNARSRegistry} from '../lm/providers.js';
import {getStructuredModel} from '../lm/providers.js';
import {TranslationSchema, type TranslationResult} from './schemas.js';
import {termParser} from '../terms/index.js';

export class NLTranslator {
    constructor(private registry: SeNARSRegistry) {}

    async translate(nl: string): Promise<TranslationResult> {
        const model = getStructuredModel(this.registry);
        if (!model) throw new Error('No quality model available for translation');

        const {object} = await generateObject({
            model,
            prompt: `Translate the following natural language input into Narsese format. Return valid Narsese beliefs that capture the meaning. Input: "${nl}"`,
            schema: TranslationSchema,
        });

        const validBeliefs = object.beliefs.filter(b => {
            try { termParser.parse(b.narsese); return true; }
            catch (e) { console.error('Invalid belief filtered:', e); return false; }
        });

        return {...object, beliefs: validBeliefs};
    }

    async translateWithFallback(nl: string, fallbackModel: LanguageModel): Promise<TranslationResult> {
        try {
            return await this.translate(nl);
        } catch (e) {
            console.error('Translation with fallback failed:', e);
            const {object} = await generateObject({
                model: fallbackModel,
                prompt: `Translate to Narsese: "${nl}"`,
                schema: TranslationSchema,
            });
            return object;
        }
    }
}
