import { readFile, writeFile, appendFile } from 'fs/promises';
import { execFile } from 'child_process';
import { sym } from '../Term.js';
import { strVal } from './OpUtils.js';

export function registerIOOps(registry) {
    const termNames = args => args.map(a => a?.name ?? String(a));

    registry.register('&print', (...args) => {
        // eslint-disable-next-line no-console
        console.log(termNames(args).join(' '));
        return args.length === 1 ? args[0] : sym('Null');
    });
    registry.register('&println', (...args) => {
        // eslint-disable-next-line no-console
        console.log(...termNames(args));
        return sym('()');
    });

    registry.register('&fs-read', async (path) => sym(await readFile(strVal(path), 'utf8')), { async: true });
    registry.register('&fs-write', async (path, content) => {
        await writeFile(strVal(path), strVal(content));
        return sym('ok');
    }, { async: true });
    registry.register('&fs-append', async (path, content) => {
        await appendFile(strVal(path), strVal(content));
        return sym('ok');
    }, { async: true });
    registry.register('&fs-read-last', async (path, maxChars) => {
        const c = await readFile(strVal(path), 'utf8');
        const n = maxChars?.name ?? maxChars ?? 30000;
        return sym(c.slice(-Number(n) || 30000));
    }, { async: true });

    registry.register('&shell', (cmd) =>
        new Promise(r => execFile('sh', ['-c', strVal(cmd)], { timeout: 10000 }, (_, o) => r(sym((o ?? '').trim())))),
        { async: true });
}
