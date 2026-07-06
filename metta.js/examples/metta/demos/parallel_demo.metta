; Parallel evaluation demo

; Map simple math operation in parallel
! (&map-parallel (1 2 3 4) $x (+ $x 10))

; Map structure construction in parallel
! (&map-parallel (1 2) $x (: $x (: $x ())))
