/**
 * Incoming message discriminated unions + aggregate type re-exports
 */
import { z } from 'zod';
import { ChatAgentComplete, ChatAgentStream, ChatUserMsg, LMSwitchMsg, LMStatusMsg, LMStatusRequest, } from './chat';
import { ConfigSchemaMsg, ConfigSetMsg } from './config';
import { ServerError } from './error';
import { CognitiveDelta } from './graph-ops';
import { NodeHistoryMsg, NodeHistoryRequestMsg } from './history';
import { LensDefinedMsg, LensDefineMsg, LensFieldsMsg, LensListMsg } from './lens-msgs';
import { ObjectSetMsg } from './object-patch';
import { UiCommandMsg } from './ui-command';
import { ReasoningSubmitMsg, ReasoningAskMsg, ReasoningStepMsg, ReasoningRunMsg, ReasoningAbortMsg, ReasoningRetractMsg, ReasoningReviseMsg, ReasoningAddGoalMsg, ReasoningAdjustBudgetMsg, ReasoningAdjustProviderMsg, ReasoningControlResponse, } from './reasoning-control';
import { CognitiveEventsMsg, FocusSet, LensSet, StateSnapshot, SyncRequest, TelemetryMsg, CycleStateMsg, CycleStepMsg, CyclePauseMsg, CycleResumeMsg, CycleRewindMsg, } from './sync';
export const IncomingFromClient = z.discriminatedUnion('type', [
    ChatUserMsg,
    ConfigSetMsg,
    SyncRequest,
    LensSet,
    FocusSet,
    ObjectSetMsg,
    LensDefineMsg,
    NodeHistoryRequestMsg,
    LMStatusRequest,
    LMSwitchMsg,
    ReasoningSubmitMsg,
    ReasoningAskMsg,
    ReasoningStepMsg,
    ReasoningRunMsg,
    ReasoningAbortMsg,
    ReasoningRetractMsg,
    ReasoningReviseMsg,
    ReasoningAddGoalMsg,
    ReasoningAdjustBudgetMsg,
    ReasoningAdjustProviderMsg,
    CycleStepMsg,
    CyclePauseMsg,
    CycleResumeMsg,
    CycleRewindMsg,
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
    ChatAgentStream,
    ChatAgentComplete,
    CognitiveDelta,
    CognitiveEventsMsg,
    ConfigSchemaMsg,
    StateSnapshot,
    TelemetryMsg,
    LensListMsg,
    LensDefinedMsg,
    LensFieldsMsg,
    NodeHistoryMsg,
    LMStatusMsg,
    ServerError,
    UiCommandMsg,
    ReasoningControlResponse,
    CycleStateMsg,
]);
