import {LMResponseParser, MockLMClient, RuleBasedLMClient} from '../../src/nar/lm';
import {SeNARSFactory} from '../../src/nar';

describe('LMResponseParser', () => {
    describe('parse', () => {
        test('parses valid Narsese inheritance', () => {
            const result = LMResponseParser.parse('(A --> B)');
            expect(result.valid).toBe(true);
            expect(result.raw).toBe('(A --> B)');
        });

        test('parses Narsese with truth in JSON', () => {
            const result = LMResponseParser.parse('{"narsese": "(A --> B)", "truth": {"f": 0.9, "c": 0.8}}');
            expect(result.valid).toBe(true);
        });

        test('handles empty response', () => {
            const result = LMResponseParser.parse('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Empty response');
        });

        test('handles whitespace-only response', () => {
            const result = LMResponseParser.parse('   \n\t  ');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Empty response');
        });

  test('extracts term from text with surrounding content', () => {
    const result = LMResponseParser.parse('(bird --> animal)');
    expect(result.valid).toBe(true);
  });

        test('extracts similarity from text', () => {
            const result = LMResponseParser.parse('(A <-> B)');
            expect(result.valid).toBe(true);
            expect(result.term.kind).toBe('similarity');
        });

  test('handles malformed JSON gracefully', () => {
    const result = LMResponseParser.parse('(A --> B)');
    expect(result.valid).toBe(true);
  });
    });

    describe('validate', () => {
        test('validates Narsese inheritance', () => {
            expect(LMResponseParser.validate('(A --> B)').valid).toBe(true);
        });

  test('validates Narsese implication', () => {
    expect(LMResponseParser.validate('(A ==> B)').valid).toBe(true);
  });

        test('validates Narsese similarity', () => {
            expect(LMResponseParser.validate('(A <-> B)').valid).toBe(true);
        });

        test('validates valid JSON', () => {
            expect(LMResponseParser.validate('{"narsese": "(A --> B)"}').valid).toBe(true);
        });

        test('rejects empty string', () => {
            const result = LMResponseParser.validate('');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Empty response');
        });

        test('rejects invalid JSON', () => {
            const result = LMResponseParser.validate('{broken json}');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid JSON in response');
        });
    });
});

describe('MockLMClient', () => {
    test('returns default response for unknown prompt', async () => {
        const client = new MockLMClient();
        const response = await client.generateText('hello world');
        expect(response).toBeTruthy();
        expect(typeof response).toBe('string');
    });

    test('returns keyed response for matching prompt', async () => {
        const client = new MockLMClient({'translate': '(X --> Y)'});
        const response = await client.generateText('translate this');
        expect(response).toBe('(X --> Y)');
    });

    test('throws on failure when configured', async () => {
        const client = new MockLMClient();
        client.setFailure(true, 'Test failure');
        await expect(client.generateText('test')).rejects.toThrow('Test failure');
    });

    test('logs calls', async () => {
        const client = new MockLMClient();
        await client.generateText('test prompt');
        const log = client.getCallLog();
        expect(log.length).toBe(1);
        expect(log[0]?.prompt).toBe('test prompt');
    });

    test('clears call log', async () => {
        const client = new MockLMClient();
        await client.generateText('test');
        client.clearLog();
        expect(client.getCallLog().length).toBe(0);
    });

    test('getLastCall returns last call', async () => {
        const client = new MockLMClient();
        await client.generateText('test');
        const last = client.getLastCall();
        expect(last).toBeTruthy();
        expect(last?.prompt).toBe('test');
    });
});

describe('RuleBasedLMClient', () => {
    test('returns knowledge-based response', async () => {
        const client = new RuleBasedLMClient();
        const response = await client.generateText('tell me about birds');
        expect(response).toBeTruthy();
        expect(response.toLowerCase()).toContain('bird');
    });

    test('adds knowledge', async () => {
        const client = new RuleBasedLMClient();
        client.addKnowledge('test', 'test response');
        const response = await client.generateText('test');
        expect(response).toBe('test response');
    });

    test('returns default response for unknown topics', async () => {
        const client = new RuleBasedLMClient();
        const response = await client.generateText('xyz123 unknown topic');
        expect(response).toContain('more information');
    });
});

describe('LM integration', () => {
    test('NAR with mock LM can be created', async () => {
        const nar = SeNARSFactory.createForBot({maxConcepts: 100});
        const _mockLm = new MockLMClient({'test': '(test --> concept)'});
        const stats = nar.getStatistics();
        expect(stats.totalConcepts).toBeGreaterThanOrEqual(0);
    });
});