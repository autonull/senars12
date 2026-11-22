// Craft gate — single entry point for all craft tests
// Run with: pnpm --dir ui test:craft

import './typography.test';
import './focus.test';
import './z-index.test';
import './icon-emoji-lint.test';
import './contrast.test';
import './motion.test';

console.log('Craft gate tests loaded');