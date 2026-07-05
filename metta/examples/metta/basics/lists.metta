
; lists.metta - List operations

; Basic list construction already uses (: h t)
; We can define helpers if needed, but stdlib provides them.


; Test cons (construction) - Explicit alias
!(cons 1 (cons 2 (nil)))

; Test car (head)
!(car (: A (: B ())))

; Test cdr (tail)
!(cdr (: A (: B ())))

; Test length
!(length (: 1 (: 2 (: 3 ()))))

; Test map
!(map (λ $x (* $x 2)) (: 1 (: 2 (: 3 ()))))

; Test filter
!(filter (λ $x (> $x 1)) (: 1 (: 2 (: 3 ()))))

; Test fold (reduce)
!(fold + 0 (: 1 (: 2 (: 3 ()))))

; Test reverse
!(reverse (: 1 (: 2 (: 3 ()))))

; Test append
!(append (: 1 (: 2 ())) (: 3 (: 4 ())))

; Test nth
!(nth 1 (: A (: B (: C ()))))
