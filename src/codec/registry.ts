/**
 * Codec registry for managing multiple codec backends.
 */

import type { Codec } from './Codec';
import { createCborCodec } from './CborCodec';
import { createMsgpackCodec } from './MsgpackCodec';
import { createJsonCodec } from './Codec';

export type CodecFormat = 'json' | 'cbor' | 'msgpack';

export interface CodecRegistry {
  getCodec<T>(format: CodecFormat): Codec<T>;
  registerCodec<T>(format: CodecFormat, codec: Codec<T>): void;
  hasCodec(format: CodecFormat): boolean;
  formats(): CodecFormat[];
}

/**
 * Default codec registry with built-in codecs.
 */
export class DefaultCodecRegistry implements CodecRegistry {
  private codecs = new Map<CodecFormat, Codec<any>>();

  constructor() {
    // Register built-in codecs
    this.registerCodec('json', createJsonCodec<any>());
    this.registerCodec('cbor', createCborCodec<any>());
    this.registerCodec('msgpack', createMsgpackCodec<any>());
  }

  getCodec<T>(format: CodecFormat): Codec<T> {
    const codec = this.codecs.get(format);
    if (!codec) {
      throw new Error(`No codec registered for format: ${format}`);
    }
    return codec as Codec<T>;
  }

  registerCodec<T>(format: CodecFormat, codec: Codec<T>): void {
    this.codecs.set(format, codec);
  }

  hasCodec(format: CodecFormat): boolean {
    return this.codecs.has(format);
  }

  formats(): CodecFormat[] {
    return Array.from(this.codecs.keys());
  }
}

/** Global default registry instance. */
let _defaultRegistry: CodecRegistry | null = null;

export function getDefaultCodecRegistry(): CodecRegistry {
  if (!_defaultRegistry) {
    _defaultRegistry = new DefaultCodecRegistry();
  }
  return _defaultRegistry;
}

export function setDefaultCodecRegistry(registry: CodecRegistry): void {
  _defaultRegistry = registry;
}

/**
 * Encode a value using the specified format.
 */
export function encode<T>(value: T, format: CodecFormat = 'json', registry: CodecRegistry = getDefaultCodecRegistry()): Uint8Array {
  return registry.getCodec<T>(format).serialize(value);
}

/**
 * Decode bytes using the specified format.
 */
export function decode<T>(bytes: Uint8Array, format: CodecFormat = 'json', registry: CodecRegistry = getDefaultCodecRegistry()): T {
  return registry.getCodec<T>(format).deserialize(bytes);
}

/**
 * Transcode from one format to another.
 */
export function transcode<T>(value: T, fromFormat: CodecFormat, toFormat: CodecFormat, registry: CodecRegistry = getDefaultCodecRegistry()): Uint8Array {
  const fromCodec = registry.getCodec<T>(fromFormat);
  const toCodec = registry.getCodec<T>(toFormat);
  const bytes = fromCodec.serialize(value);
  return toCodec.serialize(toCodec.deserialize(bytes));
}