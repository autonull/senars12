export interface Serializable<T, V = number> {
  serialize(): T;
  deserialize(data: T, version?: V): this;
  readonly version?: V;
}

export interface Versioned {
  readonly version: number;
}
