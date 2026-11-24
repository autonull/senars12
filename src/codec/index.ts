/**
 * Codec — serialization backends and registry.
 */

export * from './Codec';
export * from './CborCodec';
export * from './MsgpackCodec';
export { DefaultCodecRegistry, getDefaultCodecRegistry, setDefaultCodecRegistry, encode, decode, transcode, type CodecFormat, type CodecRegistry as UnifiedCodecRegistry } from './registry';