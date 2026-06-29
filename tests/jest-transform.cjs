/**
 * Lightweight CJS-to-ESM transform for `.js` source files in this repo.
 *
 * The repo contains a single hand-rolled ESM file (`peggy-generated.js`) that
 * is committed to the tree. Jest's default behavior treats `.js` files as
 * CommonJS, which causes the ESM `export`/`import` syntax to fail to parse.
 *
 * This transformer rewrites ESM `export` statements to CommonJS `module.exports`
 * assignments on the fly. It is intentionally minimal — anything more
 * sophisticated (real @babel/preset-env) would be overkill for a single
 * generated parser file.
 */
const { readFileSync } = require('fs');

const ESM_TO_CJS = [
  [/^export\s+default\s+/m, 'module.exports = '],
  [
    /^export\s*\{([^}]+)\}\s*;?\s*$/gm,
    (_, body) => {
      // This pattern handles "export { a, b, c }" by converting to CJS
      // But we need to also export the local bindings, so we handle it specially
      const items = body
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [source, alias] = part.split(/\s+as\s+/).map((s) => s.trim());
          return alias ? `${alias}: ${source}` : source;
        })
        .join(', ');
      // Keep the original exports available via module.exports.__esModule = true
      return `module.exports = { ${items} }; module.exports.__esModule = true;`;
    },
  ],
];

module.exports = {
  process(src, filename) {
    let out = src;
    for (const [pattern, replacement] of ESM_TO_CJS) {
      out = out.replace(pattern, replacement);
    }
    if (/^\s*import\s/m.test(out)) {
      throw new Error(
        `jest-transform: top-level import statements are not supported in ${filename}. ` +
          'Use require() instead, or extend this transformer.'
      );
    }
    if (process.env.JEST_TRANSFORM_DEBUG) {
      process.stderr.write(`[jest-transform] ${filename} (${src.length} bytes)\n`);
    }
    return { code: out };
  },
  getCacheKey(src, filename) {
    return `${filename}:${readFileSync(filename).length}`;
  },
};
