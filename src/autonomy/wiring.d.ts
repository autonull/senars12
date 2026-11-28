import type { AutonomyNAR } from './ports';
import { AutonomyHeartbeat } from './heartbeat';
/**
 * Bind the heartbeat to a NAR's kernel, memory and bus (CORE.19 C5.2). Kept out
 * of `nar.ts` so the facade stays under its monolith budget: the wiring names
 * only the public surface it drives.
 */
export declare const createAutonomyHeartbeat: (nar: AutonomyNAR) => AutonomyHeartbeat;
//# sourceMappingURL=wiring.d.ts.map