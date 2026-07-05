; Macro Examples
; Demonstrates macro definition and expansion

; Basic macro - when
(= (when $cond $body)
   (if $cond $body Empty))

; Usage
(when (> 5 3)
  (print "5 is greater than 3"))

; Unless macro
(= (unless $cond $body)
   (if (not $cond) $body Empty))

; Usage
(unless (< 10 5)
  (print "10 is not less than 5"))

; Let* macro (sequential let)
(= (let* () $body) $body)
(= (let* ($var $val . $rest) $body)
   (let $var $val (let* $rest $body)))
