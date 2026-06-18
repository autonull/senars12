const fs = require('fs');

let code = fs.readFileSync('src/nar/utils/circuit-breaker.ts', 'utf8');

code = code.replace("export interface CircuitBreakerConfig", "import {OperationError} from '../types/core.js';\nimport {createLogger} from '../logger/index.js';\n\nconst logger = createLogger({scope: 'circuit-breaker'});\n\nexport interface CircuitBreakerConfig");

code = code.replace("throw new Error('Circuit breaker is open');", "logger.warn('Circuit breaker execution rejected: circuit is open');\n                throw new OperationError('Circuit breaker is open', { state: this.state });");
code = code.replace("if (this.failures >= this.config.failureThreshold) this.state = 'open';", "if (this.failures >= this.config.failureThreshold) {\n            if (this.state !== 'open') logger.warn('Circuit breaker state changed: ' + this.state + ' -> open');\n            this.state = 'open';\n        }");
code = code.replace("this.state = 'half-open';", "logger.info('Circuit breaker state changed: open -> half-open');\n                this.state = 'half-open';");
code = code.replace("this.state = 'closed';\n                this.failures = 0;", "logger.info('Circuit breaker state changed: half-open -> closed');\n                this.state = 'closed';\n                this.failures = 0;");
code = code.replace("this.state = 'closed';\n        this.failures = 0;", "if (this.state !== 'closed') logger.info('Circuit breaker state reset to closed');\n        this.state = 'closed';\n        this.failures = 0;");

fs.writeFileSync('src/nar/utils/circuit-breaker.ts', code);
