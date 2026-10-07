/**
 * Test-side view of the scenario catalog. The definitions themselves live in
 * `@senars/ui/scenarios` (server-owned, the one source the `/test/scenario`
 * endpoint loads from); this module is the E2E/gallery import site so specs never
 * reach across the package boundary or hand-roll belief lists.
 */
export {
  loadScenario,
  SCENARIOS,
  scenarioById,
  scenarioIds,
  type Scenario,
  type ScenarioEngine,
} from '@senars/ui/scenarios';

import { SCENARIOS, type Scenario } from '@senars/ui/scenarios';

/** The scenarios with committed expectations, in the order the gallery shows them. */
export const CANONICAL_SCENARIOS: Scenario[] = [
  SCENARIOS.bootstrap,
  SCENARIOS['basic-derivation'],
  SCENARIOS['conflicting-evidence'],
];
