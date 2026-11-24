/**
 * CBOR codec implementation.
 *
 * Uses cbor-x for encoding/decoding.
 */

import { encode, decode } from 'cbor-x';
import type { Codec } from './Codec';

/**
 * CBOR codec for any serializable type.
 */
export class CborCodec<T> implements Codec<T> {
  version = 1;

  serialize(value: T): Uint8Array {
    return encode(value);
  }

  deserialize(bytes: Uint8Array): T {
    return decode(bytes);
  }

  toString(value: T): string {
    return encode(value).toString();
  }

  fromString(str: string): T {
    return decode(new Uint8Array(Buffer.from(str, 'base64')));
  }
}

/**
 * Create a CBOR codec for a specific type.
 */
export function createCborCodec<T>(): Codec<T> {
  return new CborCodec<T>();
}