import { EventBus } from '@senars/events/event-bus';
import type { Manifest, Mark } from './schema.js';
export interface RecorderOptions {
    bundleDir: string;
    surfaces: ('console' | 'ui')[];
    keyframeMarks: string[];
    maxFrames: number;
    lane: 'hermetic' | 'live';
    eventBus: EventBus;
}
interface FrameHash {
    hash: string;
    timestamp: number;
    markId?: string;
}
export declare class Recorder {
    #private;
    constructor(options: RecorderOptions);
    start(): Promise<void>;
    stop(): Promise<{
        manifest: Manifest;
        eventDigest: string;
    }>;
    getMarks(): Mark[];
    getFrameHashes(): FrameHash[];
    getEventSeq(): number;
}
export declare function createRecorder(options: RecorderOptions): Promise<Recorder>;
export {};
//# sourceMappingURL=record.d.ts.map