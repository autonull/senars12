/**
 * extensions/index.js - Export module for extension modules
 */

// Core extensions (always available)
export {ChannelExtension} from './ChannelExtension.js';
export {MemoryExtension} from './MemoryExtension.js';
export {ReactiveSpace} from './ReactiveSpace.js';

// MORK-parity extensions (Phase P2-P4)
export {NeuralBridge} from './NeuralBridge.js';
export {PersistentSpace} from './PersistentSpace.js';
export {SMTBridge} from './SMTOps.js';
export {VisualDebugger, visualDebugger} from './VisualDebugger.js';

// ImaginationExtension requires @napi-rs/canvas and gifencoder
// export { ImaginationExtension } from './ImaginationExtension.js';
