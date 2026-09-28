import { clamp01 } from '../utils/shared.js';

export type Frequency = number & { readonly __brand: unique symbol };
export type Confidence = number & { readonly __brand: unique symbol };

export function toFrequency(value: number): Frequency {
  return clamp01(value) as Frequency;
}

export function toConfidence(value: number): Confidence {
  return clamp01(value) as Confidence;
}
