; Interactive UI Generation Demo
; This script demonstrates how the system can request user input via dynamic UI widgets
; and use the response in reasoning.

; 1. System determines a concept has low confidence
; (simulated state: <bird --> flyer>. {0.9 0.1})

; 2. System requests human clarification
; (log output) Requesting input for: <bird --> flyer>

; 3. System highlights the console area to draw attention
; (frontend action: ui_highlight selector=".logs-container" message="Please review the request below")

; 4. System generates a Truth Slider widget
; (frontend action: render WidgetType.SLIDER)

; 5. User adjusts slider to {0.9 0.9} and confirms

; 6. System receives input and updates memory
!(add (Inheritance bird flyer) (Truth 0.9 0.9))

; 7. Reasoning continues with new high-confidence belief
!(derive (Inheritance bird animal))
