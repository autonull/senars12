; memory.metta — Memory convenience wrappers
; Delegates to grounded ops for history and semantic memory operations

(= (remember $str) (^ &remember $str))
(= (query $str) (^ &recall $str))
(= (get-history $max-chars) (^ &fs-read-last "memory/history.metta" $max-chars))
