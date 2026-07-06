import {PlatformNode} from './PlatformNode.js';
import {PlatformBrowser} from './PlatformBrowser.js';

let currentPlatform = null;

export function getPlatform() {
    if (currentPlatform) {
        return currentPlatform;
    }

    // Detect environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        currentPlatform = new PlatformNode();
    } else {
        currentPlatform = new PlatformBrowser();
    }

    return currentPlatform;
}

export function setPlatform(platform) {
    currentPlatform = platform;
}
