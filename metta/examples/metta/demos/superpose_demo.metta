; Superpose Demo: Non-Deterministic Evaluation using minimal MeTTa instructions
; This script demonstrates superpose, collapse-bind, and non-deterministic rules.

; 1. Basic Superposition
; expand to multiple values
!(superpose (A B C))
; Output: [A, B, C]

; 2. Nested Superposition
; (+ 1 (superpose (1 2))) -> (+ 1 1) and (+ 1 2)
!(+ 1 (superpose (1 2)))
; Output: [2, 3]

; 3. Non-deterministic Rules
(= (color) red)
(= (color) green)
(= (color) blue)

; Query the color
!(color)
; Output: [red, green, blue]

; 4. Collapse Bind
; Collect all results of a non-deterministic evaluation into a single list
!(collapse-bind (color))
; Output: [(color) matching results as a list]

; 5. Superpose Bind (Inverse of collapse)
; Take a list and expand it back into multiple results
!(superpose-bind (1 2 3))
; Output: [1, 2, 3]

; 6. Empty Superposition (Pruning)
; (superpose ()) results in NO branches, effectively stopping the evaluation path.
!(+ 10 (superpose ()))
; Output: [] (Empty set)

; 7. Complex Logic
(= (bin) 0)
(= (bin) 1)

; Generate all 2-bit binary numbers
!((bin) (bin))
; Output: [(0 0), (0 1), (1 0), (1 1)]
