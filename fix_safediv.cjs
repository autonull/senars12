const fs = require('fs');

let truth = fs.readFileSync('src/nar/terms/truth.ts', 'utf8');

// Truth uses safeDiv directly in its object initialization, but safeDiv is imported from utils
// This can cause circular dependency issues during module loading.
// Instead of referencing safeDiv from utils directly in the object property shorthand, we can do it inline or keep using it. Wait, the problem is safeDiv is imported from '../utils' at the top of truth.ts. `import {clamp, safeDiv} from '../utils';` The actual file is `../utils/index.ts`. And `index.ts` might export something that imports `truth.ts`, causing circular init.
// Solution: avoid exporting safeDiv in Truth, or import it directly from `../utils/math.js` (if it exists).
// Actually, `safeDiv` is tiny. Let's just inline it or just remove `safeDiv` property from `Truth` if it's not used externally, or change how we define it.
// Let's replace `safeDiv,` with `safeDiv: (a: number, b: number): number => Math.abs(b) < 1e-9 ? 0 : a / b,`

truth = truth.replace(/safeDiv,\n/g, "safeDiv: (a: number, b: number): number => Math.abs(b) < 1e-9 ? 0 : a / b,\n");

fs.writeFileSync('src/nar/terms/truth.ts', truth);
