import type {NAR} from '../nar.js';
import {counterfactual} from '../reason/counterfactual.js';
import {atom} from '../terms/factory.js';

export async function runCounterfactual(
  termStr: string,
  negate: boolean,
  nar: NAR,
  steps = 5,
): Promise<string> {
  const term = atom(termStr);
  const result = await counterfactual(term, negate, nar, steps);

  if (!result.possible) {
    return `I cannot reason counterfactually about "${termStr}": ${result.reason}`;
  }

  let response = `If ${termStr} were ${negate ? 'not' : 'true'}, `;
  if (result.whatWouldChange.length > 0) {
    response += `the following would change: ${result.whatWouldChange.slice(0, 3).join('; ')}. `;
  }
  if (result.dependentBeliefs.length > 0) {
    response += `Dependent beliefs: ${result.dependentBeliefs.slice(0, 3).join('; ')}.`;
  }
  return response;
}
