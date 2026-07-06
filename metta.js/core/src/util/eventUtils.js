/**
 * Event emission utilities for SeNARS
 */

/**
 * Emit event to bus with standardized payload enrichment
 */
export async function emitEvent(bus, eventName, payload, options = {}) {
    if (!bus) {
        return;
    }

    const {
        source = null,
        includeTimestamp = true,
        includeUptime = false,
        uptime = 0
    } = options;

    const enrichedPayload = {
        ...(includeTimestamp && {timestamp: Date.now()}),
        ...(source && {source}),
        ...(includeUptime && {uptime}),
        ...payload
    };

    await bus.emit(eventName, enrichedPayload);
}

/**
 * Emit event with component context
 */
export async function emitComponentEvent(bus, eventName, payload, componentName, uptime = 0) {
    await emitEvent(bus, eventName, payload, {
        source: componentName,
        includeTimestamp: true,
        includeUptime: true,
        uptime
    });
}

/**
 * Emit event with provider context (dual emission: local + bus)
 */
export function emitProviderEvent(localEmitter, eventBus, eventName, payload, providerId) {
    const enrichedPayload = {
        provider: providerId,
        timestamp: Date.now(),
        ...payload
    };

    localEmitter.emit(eventName, enrichedPayload);
    if (eventBus) {
        eventBus.emit(eventName, enrichedPayload);
    }
}
