/**
 * MessagePack codec implementation.
 *
 * Uses @msgpack/msgpack for encoding/decoding.
 */

import { encode, decode } from '@msgpack/msgpack';
import type { Codec } from './Codec';

/**
 * MessagePack codec for any serializable type.
 */
export class MsgpackCodec<T> implements Codec<T> {
  version = 1;

  serialize(value: T): Uint8Array {
    return new Uint8Array(encode(value));
  }

  deserialize(bytes: Uint8Array): T {
    return decode(bytes) as T;
  }

  toString(value: T): string {
    return Buffer.from(this.serialize(value)).toString('base64');
  }

  fromString(str: string): T {
    return decode(new Uint8Array(Buffer.from(str, 'base64'))) as T;
  }
}

/**
 * Create a MessagePack codec for a specific type.
 */
export function createMsgpackCodec<T>(): Codec<T> {
  return new MsgpackCodec<T>();
}