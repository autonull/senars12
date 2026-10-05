### Multi-Agent Cognitive Cooperation

SeNARS instances cooperate by delegating cognitive tasks via Narsese over
WebSocket (`nar/src/cooperation/delegation.ts`). Agent A sends a
`CognitiveTaskDelegation` (taskId, LM rule id, serialized NAL context, callback
endpoint); Agent B runs the *same universal LM rule* with its local model and
returns a `CognitiveTaskResult` of Narsese terms with truth values. Results are
admitted through the PerceptionGate with `PEER_AGENT` source quality and
shadow-validated before entering memory.
