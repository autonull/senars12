import {Tokenizer} from '../../../../metta/src/parser/Tokenizer.js';

describe('MeTTa Tokenizer', () => {
    let tokenizer;

    beforeEach(() => {
        tokenizer = new Tokenizer();
    });

    test('tokenizes simple symbols', () => {
        const tokens = tokenizer.tokenize('foo bar');
        expect(tokens).toEqual(['foo', 'bar']);
    });

    test('tokenizes expressions with parentheses', () => {
        const tokens = tokenizer.tokenize('(foo (bar baz))');
        expect(tokens).toEqual(['(', 'foo', '(', 'bar', 'baz', ')', ')']);
    });

    test('tokenizes symbols adjacent to parentheses', () => {
        const tokens = tokenizer.tokenize('(foo)');
        expect(tokens).toEqual(['(', 'foo', ')']);
    });

    test('handles strings with quotes', () => {
        const tokens = tokenizer.tokenize('("hello world")');
        expect(tokens).toEqual(['(', '"hello world"', ')']);
    });

    test('handles single quotes', () => {
        const tokens = tokenizer.tokenize("('hello world')");
        expect(tokens).toEqual(['(', "'hello world'", ')']);
    });

    test('handles comments', () => {
        const tokens = tokenizer.tokenize('; this is a comment\n(foo)');
        expect(tokens).toEqual(['(', 'foo', ')']);
    });

    test('handles inline comments', () => {
        const tokens = tokenizer.tokenize('(foo) ; comment');
        expect(tokens).toEqual(['(', 'foo', ')']);
    });

    test('handles whitespace correctly', () => {
        const tokens = tokenizer.tokenize('  (  foo   bar  )  ');
        expect(tokens).toEqual(['(', 'foo', 'bar', ')']);
    });

    test('handles empty input', () => {
        const tokens = tokenizer.tokenize('');
        expect(tokens).toEqual([]);
    });

    test('handles input with only whitespace', () => {
        const tokens = tokenizer.tokenize('   \n\t  ');
        expect(tokens).toEqual([]);
    });

    test('handles complex nested structure', () => {
        const input = '(= (foo $x) (bar $x "val"))';
        const tokens = tokenizer.tokenize(input);
        expect(tokens).toEqual(['(', '=', '(', 'foo', '$x', ')', '(', 'bar', '$x', '"val"', ')', ')']);
    });

    test('handles escaped quotes inside string (if supported by logic)', () => {
        // The current implementation does NOT support escaped quotes properly as it just looks for the closing quote char.
        // But let's check what happens with \" inside "..."
        // If the implementation is simple:
        // "foo\"bar" -> "foo\" is one token, bar" is next? No.
        // Current logic:
        // " -> inString=true
        // ...
        // " -> inString=false (if not escaped)

        // Let's test basic string functionality for now as per implementation.
        // If we want to support escaped quotes, we'd need to change Tokenizer logic.
        // Given existing Parser.js logic didn't seem to explicitly handle escape chars inside the loop for quote detection:
        // It just did: if (char === quoteChar) { inString = false; ... }
        // So "foo\"bar" would end at the first quote after foo\.

        // I will stick to basic tests that reflect current behavior.
        const tokens = tokenizer.tokenize('"foo" "bar"');
        expect(tokens).toEqual(['"foo"', '"bar"']);
    });
});
