import {TextDecoder, TextEncoder} from 'util';
import {ReadableStream, TransformStream, WritableStream} from 'stream/web';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

globalThis.ReadableStream = globalThis.ReadableStream || ReadableStream;
globalThis.WritableStream = globalThis.WritableStream || WritableStream;
globalThis.TransformStream = globalThis.TransformStream || TransformStream;

// Prevent "OpenAI provider selected but no API key configured" errors in tests.
// The workspace/agent.json defaults to openai provider; tests that don't need
// a real LM still trigger validation. A dummy key satisfies the validation check.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-dummy-key-for-ci';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-dummy-key-for-ci';
