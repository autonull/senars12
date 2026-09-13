export type Frequency = number & { readonly __brand: unique symbol };
export type Confidence = number & { readonly __brand: unique symbol };

export function toFrequency(value: number): Frequency {
  return Math.max(0, Math.min(1, value)) as Frequency;
}

export function toConfidence(value: number): Confidence {
  return Math.max(0, Math.min(1, value)) as Confidence;
}
