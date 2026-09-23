import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const run = process.env.VITEST_E2E === '1' ? it : it.skip;

const drive = (input: string, env: Record<string, string> = {}): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'src/bin/bot.ts'],
      {
        cwd: root,
        timeout: 180_000,
        killSignal: 'SIGKILL',
        env: {
          ...process.env,
          LM_PROVIDER: 'mock',
          ...env,
        },
      }
    );
    let out = '';
    child.stdout?.on('data', (d) => { out += String(d); });
    child.stderr?.on('data', (d) => { out += String(d); });
    child.on('error', reject);
    child.on('close', () => resolve(out));
    child.stdin?.write(input);
    child.stdin?.end();
  });

describe('bot CLI (TODO21 unified entry)', () => {
  run('boots CLI-only with full help and clean quit', async () => {
    const out = await drive('.help\n.connections\n.quit\n');
    expect(out).toContain('CLI-first bot');
    expect(out).toContain('.connect irc');
    expect(out).toContain('No active connections (CLI-only mode)');
    expect(out).toContain('Goodbye!');
  }, 180_000);

  run('lm/health/doctor/config commands respond', async () => {
    const out = await drive('.lm-config\n.health\n.doctor\n.config-show\n.quit\n');
    expect(out).toContain('provider=mock');
    expect(out).toContain('lm=mock');
    expect(out).toContain('"profile"');
  }, 180_000);

  run('ENABLE_WS=true auto-connects (opt-in server mode)', async () => {
    const out = await drive('.connections\n.quit\n', { ENABLE_WS: 'true', WS_PORT: '18767' });
    expect(out).toContain('ws-main (websocket): connected');
  }, 180_000);
});
