; Non-Determinism Examples
; Demonstrates superpose and collapse

; Basic superposition
(= (choice) (superpose a b c))
!(choice)
; Expected: (superpose a b c) or one of {a, b, c} after collapse

; Non-deterministic computation
(= (number) (superpose 1 2 3 4 5))
(= (even $n) (== (% $n 2) 0))

; Filtering superposition
(= (even-numbers) (collapse (superpose 1 2 3 4 5 6)))

; Non-deterministic search
(= (color) (superpose red green blue))
(= (size) (superpose small medium large))
(= (product) (* (color) (size)))
; Produces all combinations
