import { circularChainsAsync } from './scripts/lib/dpdm.js';

const chains = await circularChainsAsync({ transform: false });
console.log('Circular chains:', chains.length);
for (const chain of chains) {
  console.log('  ', chain.join(' -> '));
}