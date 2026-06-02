/**
 * End-to-end test that exercises the AIAgent against a real Language Model
 * (Transformers.js + SmolLM2-135M-Instruct, already cached in the repo).
 *
 * Jest's VM-based module isolation breaks ONNX Runtime Web's Float32Array
 * cross-realm checks, so the actual inference has to happen in a child
 * Node process. This test spawns `scripts/demo-real-lm.ts` and asserts on
 * the structured output. The demo itself exits non-zero on failure.
 *
 * Skipped cleanly when the model weights are not present locally.
 */

import {existsSync} from 'fs';
import {join} from 'path';
import {spawn} from 'child_process';
import {beforeAll, describe, expect, test} from '@jest/globals';

const MODEL_ONNX = join(
    process.cwd(),
    'node_modules', '.pnpm',
    '@huggingface+transformers@3.8.1',
    'node_modules', '@huggingface', 'transformers',
    '.cache', 'HuggingFaceTB', 'SmolLM2-135M-Instruct',
    'onnx', 'model.onnx',
);

const candidates = [
    MODEL_ONNX,
    join(process.env.HF_HOME ?? '', 'HuggingFaceTB', 'SmolLM2-135M-Instruct', 'onnx', 'model.onnx'),
    join(process.env.HOME ?? '/root', '.cache', 'huggingface', 'hub', 'HuggingFaceTB--SmolLM2-135M-Instruct', 'onnx', 'model.onnx'),
];

const modelCached = candidates.some((p) => p && existsSync(p));
const describeIfCached = modelCached ? describe : describe.skip;

describeIfCached('Real LM agent conversation (SmolLM2-135M, child process)', () => {
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = null;

    beforeAll(async () => {
        const result = await runDemo();
        stdout = result.stdout;
        stderr = result.stderr;
        exitCode = result.code;
    }, 180_000);

    test('demo exits 0', () => {
        if (exitCode !== 0) {
            console.error('--- STDOUT ---\n' + stdout);
            console.error('--- STDERR ---\n' + stderr);
        }
        expect(exitCode).toBe(0);
    });

    test('LM was loaded', () => {
        expect(stdout).toMatch(/LM ready/);
    });

    test('at least one LM call per probe (3 probes)', () => {
        const matches = stdout.match(/lmCalls=(\d+)/g) ?? [];
        expect(matches.length).toBe(3);
        for (const match of matches) {
            const n = parseInt(match.replace('lmCalls=', ''), 10);
            expect(n).toBeGreaterThanOrEqual(1);
        }
    });

    test('LM produced non-empty prose for the greeting probe', () => {
        const greeting = stdout.match(/probe="greeting"[\s\S]*?reply="([^"]+)"/);
        expect(greeting).not.toBeNull();
        expect(greeting![1].length).toBeGreaterThan(0);
    });

    test('LM totals are consistent (3 successes)', () => {
        const totals = stdout.match(/calls=(\d+) ok=(\d+) fail=(\d+)/);
        expect(totals).not.toBeNull();
        const [, calls, ok, fail] = totals!;
        expect(parseInt(calls, 10)).toBe(3);
        expect(parseInt(ok, 10)).toBe(3);
        expect(parseInt(fail, 10)).toBe(0);
    });
});

interface RunResult {
    code: number | null;
    stdout: string;
    stderr: string;
}

function runDemo(): Promise<RunResult> {
    return new Promise((resolve) => {
        const child = spawn(
            process.execPath,
            ['--import', 'tsx', 'scripts/demo-real-lm.ts'],
            {cwd: process.cwd(), env: {...process.env, NODE_NO_WARNINGS: '1'}, stdio: ['ignore', 'pipe', 'pipe']},
        );
        let out = '';
        let err = '';
        child.stdout.on('data', (d) => { out += d.toString(); });
        child.stderr.on('data', (d) => { err += d.toString(); });
        child.on('close', (code) => resolve({code, stdout: out, stderr: err}));
    });
}
