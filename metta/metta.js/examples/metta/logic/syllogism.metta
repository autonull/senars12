; Classic Syllogism
; All humans are mortal. Socrates is human. Therefore, Socrates is mortal.

; Facts
(= (human Socrates) True)
(= (human Plato) True)
(= (human Aristotle) True)

; Rule: All humans are mortal
(= (mortal $x) (human $x))

; Queries
!(mortal Socrates)
; Expected: True

!(mortal Plato)
; Expected: True

!(mortal Zeus)
; Expected: (mortal Zeus) - no match
