; Reactive Space Demo
; verifying add, remove, addRule events and log retrieval

; 1. Add atoms (triggers 'add' event)
(A)
(B)

; 2. Add rule (triggers 'addRule' event)
(= (foo $x) (bar $x))

; 3. Retrieve event log
; Expected: List of events (add A), (add B), (addRule (= (foo $x) (bar $x)))
! (get-event-log)

; 4. Clear log
! (clear-event-log)

; 5. Verify empty
! (get-event-log)

; 6. Add more
(C)
! (get-event-log)
