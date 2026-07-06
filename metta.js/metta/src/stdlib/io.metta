; io.metta — I/O convenience wrappers
; Delegates to grounded ops for filesystem, shell, and time operations

(= (read-file $path) (&fs-read $path))
(= (write-file $path $content) (&fs-write $path $content))
(= (append-file $path $content) (&fs-append $path $content))
(= (read-file-last $path $max-chars) (&fs-read-last $path $max-chars))
(= (shell $cmd) (&shell $cmd))
(= (get-time) (&time))
(= (get-time-str) (&time-str))
(= (parse-sexpr $str) (&sread (&balance-parens $str)))
