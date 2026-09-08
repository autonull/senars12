export type Nat = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type BoundedNat =
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 20
    | 30
    | 40
    | 50
    | 60
    | 70
    | 80
    | 90
    | 100;

export type Increment<N extends Nat> = N extends 0
    ? 1
    : N extends 1
        ? 2
        : N extends 2
            ? 3
            : N extends 3
                ? 4
                : N extends 4
                    ? 5
                    : N extends 5
                        ? 6
                        : N extends 6
                            ? 7
                            : N extends 7
                                ? 8
                                : N extends 8
                                    ? 9
                                    : N extends 9
                                        ? 10
                                        : 10;
export type Decrement<N extends Nat> = N extends 1
    ? 0
    : N extends 2
        ? 1
        : N extends 3
            ? 2
            : N extends 4
                ? 3
                : N extends 5
                    ? 4
                    : N extends 6
                        ? 5
                        : N extends 7
                            ? 6
                            : N extends 8
                                ? 7
                                : N extends 9
                                    ? 8
                                    : N extends 10
                                        ? 9
                                        : 0;
export type Bounded<N extends BoundedNat> = N extends N ? N : never;

export const DEPTH_MAX = 10 as const;
export const DEPTH_DEFAULT = 10;
