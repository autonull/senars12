const fs = require('fs');

let code = fs.readFileSync('src/nar/lm/transformers-client.ts', 'utf8');
code = code.replace(/import \{CircuitBreaker\} from '\.\.\/utils\/circuit-breaker\.js';/g, "import {CircuitBreaker} from '../utils/circuit-breaker.js';\nimport {OperationError} from '../types/core.js';");
code = code.replace(/throw new Error\('Transformers\.js model not initialized'\);/g, "throw new OperationError('Transformers.js model not initialized');");
fs.writeFileSync('src/nar/lm/transformers-client.ts', code);
