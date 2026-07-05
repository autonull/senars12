import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                globalThis: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                queueMicrotask: 'readonly',
                structuredClone: 'readonly',
                fetch: 'readonly',
                Response: 'readonly',
                Request: 'readonly',
                Headers: 'readonly',
                crypto: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                performance: 'readonly',
                navigator: 'readonly',
                window: 'readonly',
                document: 'readonly',
                HTMLElement: 'readonly',
                CustomEvent: 'readonly',
                EventTarget: 'readonly',
                Event: 'readonly',
                WebSocket: 'readonly',
                FileReader: 'readonly',
                Blob: 'readonly',
                File: 'readonly',
                ReadableStream: 'readonly',
                WritableStream: 'readonly',
                TransformStream: 'readonly',
                AbortController: 'readonly',
                AbortSignal: 'readonly',
                BroadcastChannel: 'readonly',
                MessageChannel: 'readonly',
                MessagePort: 'readonly',
                SharedArrayBuffer: 'readonly',
                WebAssembly: 'readonly',
                Worker: 'readonly',
                location: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                prompt: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
            },
        },
        rules: {
            // Error handling: no empty catch blocks
            'no-empty': ['error', { allowEmptyCatch: false }],

            // Naming: consistent function naming
            'func-style': ['warn', 'declaration', { allowArrowFunctions: true }],

            // Imports: no unused imports
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true,
            }],

            // Code structure: no unnecessary console calls in production
            'no-console': 'warn',

            // Terse syntax: prefer template literals
            'prefer-template': 'error',
            'no-useless-concat': 'error',

            // Prefer destructuring
            'prefer-destructuring': ['warn', {
                object: true,
                array: false,
            }],

            // Prefer const over let where possible
            'prefer-const': ['error', {
                destructuring: 'all',
                ignoreReadBeforeAssign: false,
            }],

            // No var
            'no-var': 'error',

            // Curly braces for all control statements
            curly: ['error', 'all'],

            // Eqeqeq: prefer strict equality
            eqeqeq: ['error', 'always', { null: 'ignore' }],

            // No unused expressions
            'no-unused-expressions': 'error',

            // No duplicate imports
            'no-duplicate-imports': 'error',

            // Require await on correct expressions
            'require-await': 'warn',

            // No async without await
            'require-atomic-updates': 'warn',
        },
    },
    {
        // Ignore patterns
        ignores: [
            'node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            'browser-bundle.js',
            'ui/browser-bundle.js',
            'ui/playwright-report/**',
            'ui/test-results/**',
            'test-results/**',
            '**/*.test.js',
            '**/*.spec.js',
            'tests/**',
            '__mocks__/**',
            'scripts/**',
            'examples/**',
            'exp/**',
            'metta/src/parser/peggy-parser.js',
            'verification/**',
        ],
    },
];
