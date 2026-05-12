import type {SerializedLayer, SerializedLinkEntry, SerializedLinkManager} from './types.js';

export function serializeLinkEntry(entry: SerializedLinkEntry): SerializedLinkEntry {
    return {
        id: entry.id,
        sourceTerm: entry.sourceTerm,
        targetTerm: entry.targetTerm,
        type: entry.type,
        priority: entry.priority,
        createdAt: entry.createdAt,
        lastAccessedAt: entry.lastAccessedAt,
    };
}

export function serializeLayer(layer: SerializedLayer): SerializedLayer {
    return {
        name: layer.name,
        capacity: layer.capacity,
        links: layer.links.map(serializeLinkEntry),
    };
}

export function serializeLinkManager(data: SerializedLinkManager): SerializedLinkManager {
    return {
        version: data.version,
        layers: data.layers.map(serializeLayer),
        config: data.config,
    };
}

export function deserializeLinkEntry(data: SerializedLinkEntry): SerializedLinkEntry {
    return data;
}

export function deserializeLayer(data: SerializedLayer): SerializedLayer {
    return {
        name: data.name,
        capacity: data.capacity,
        links: data.links.map(deserializeLinkEntry),
    };
}

export function deserializeLinkManager(data: SerializedLinkManager): SerializedLinkManager {
    return {
        version: data.version,
        layers: data.layers.map(deserializeLayer),
        config: data.config,
    };
}
