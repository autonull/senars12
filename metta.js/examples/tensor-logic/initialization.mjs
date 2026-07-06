// initialization.mjs
import {T} from '../../core/src/functor/backends/NativeBackend.js';

console.log('=== Initialization Strategies ===\n');

const zeros = T.zeros([2, 3]);
console.log('zeros([2,3]):', zeros.toArray(), `mean: ${T.mean(zeros).data[0].toFixed(2)}`);

const random = T.random([2, 3]);
console.log('random([2,3]) U[0,1]:', random.toArray().map(row => row.map(v => v.toFixed(3))));
console.log(`  mean: ${T.mean(random).data[0].toFixed(3)}, std: ${T.std(random).data[0].toFixed(3)}`);

const randn = T.randn([2, 3]);
console.log('randn([2,3]) N(0,1):', randn.toArray().map(row => row.map(v => v.toFixed(3))));
console.log(`  mean: ${T.mean(randn).data[0].toFixed(3)}, std: ${T.std(randn).data[0].toFixed(3)}`);

const xavier = T.xavierUniform([3, 4]);
const xavierBound = Math.sqrt(6.0 / (3 + 4));
console.log(`\nxavier([3,4]) U[-${xavierBound.toFixed(3)}, ${xavierBound.toFixed(3)}]:`);
console.log(xavier.toArray().map(row => row.map(v => v.toFixed(3))));

const kaiming = T.kaimingNormal([3, 4]);
console.log('\nkaiming([3,4]) N(0, sqrt(2/3)):', kaiming.toArray().map(row => row.map(v => v.toFixed(3))));

console.log('\n✅ Initialization complete!');
