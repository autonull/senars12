import {AdvancedNarseseTranslator, HuggingFaceProvider, LangChainProvider} from '@senars/core/src/lm/index';

describe('Module Syntax Check', () => {
    test('should import modules without syntax errors', () => {
        [LangChainProvider, HuggingFaceProvider, AdvancedNarseseTranslator]
            .forEach(provider => expect(provider).toBeDefined());
    });
});
