import {anthropic} from '@ai-sdk/anthropic';
import {generateText} from 'ai';

async function testLLM() {
    console.log('Testing Vercel AI SDK with Anthropic...\n');

    try {
        const model = anthropic('claude-3-5-sonnet-20241022');

        console.log('Prompt: "In one sentence, what is 2+2?"');
        const {text} = await generateText({
            model,
            prompt: 'In one sentence, what is 2+2?',
        });

        console.log('Response:', text);
        console.log('\n✓ LLM integration successful');
    } catch (error) {
        console.error('✗ LLM test failed:', error instanceof Error ? error.message : error);
        console.log('\nMake sure you have:');
        console.log('1. ANTHROPIC_API_KEY set in environment');
        console.log('2. Internet connection');
        console.log('3. Valid API key with credits');
        process.exit(1);
    }
}

testLLM();
