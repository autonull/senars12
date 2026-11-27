/**
 * Loading the shipped table (TODO29.a §5.10).
 *
 * A module of its own because of a real circular dependency, not a naming
 * preference: `registration.ts` declares the table's two halves, `rule-table.ts`
 * loads them, and a `loadBuiltinTable` living in either would close the loop —
 * `registration → rule-table → registration`. The composition belongs with the
 * composition, which is what this file is.
 */
import { RuleTableStore } from './rule-table';
/** Load the shipped table. The one place the built-ins enter the system. */
export declare const loadBuiltinTable: () => RuleTableStore;
//# sourceMappingURL=builtin-table.d.ts.map