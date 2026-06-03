import type {ConversationState} from '../ConversationState.js';
import type {SlotName, SlotValue} from './WorkingMemory.js';
import {WorkingMemory} from './WorkingMemory.js';

export const WM_SLOT_KEY = '__workingMemory__';

export function loadPersistedWM(conversation?: ConversationState): {slots: Array<{name: SlotName; value: SlotValue; expiresAt: number}>} | null {
    if (!conversation) return null;
    const raw = conversation.get<string>(WM_SLOT_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function persistWM(conversation: ConversationState | undefined, wm: WorkingMemory): void {
    if (!conversation) return;
    conversation.set(WM_SLOT_KEY, JSON.stringify(wm.toJSON()));
}
