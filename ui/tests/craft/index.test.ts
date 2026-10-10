// Craft gate — single entry point for all craft tests
// Run with: pnpm --dir ui test:craft

import './typography.test.js';
import './focus.test.js';
import './z-index.test.js';
import './icon-emoji-lint.test.js';
import './contrast.test.js';
import './motion.test.js';

console.log('Craft gate tests loaded');