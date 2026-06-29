import {IncomingFromServer, type IncomingFromServer as IncomingMessage,} from '../../shared/protocol.js';
import {applyServerMessage} from './store-bindings.js';
import {$connectionState, $lastSeqId} from './store.js';

const WS_URL = `ws://${location.host}/ws`;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;

let socket: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connect(): void {
    $connectionState.set(socket ? 'reconnecting' : 'connecting');
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        reconnectAttempt = 0;
        $connectionState.set('connected');
        socket!.send(JSON.stringify({type: 'sync.request', lastSeqId: $lastSeqId.get()}));
    };

    socket.onmessage = (ev) => {
        if (ev.data === 'pong') return;
        const parsed = IncomingFromServer.safeParse(JSON.parse(ev.data as string));
        if (!parsed.success) {
            console.error('[WS] Malformed message dropped:', parsed.error, ev.data);
            return;
        }
        applyServerMessage(parsed.data as IncomingMessage);
    };

    socket.onclose = () => {
        $connectionState.set('reconnecting');
        scheduleReconnect();
    };

    socket.onerror = () => socket?.close();
}

function scheduleReconnect(): void {
    if (reconnectTimer) return;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** reconnectAttempt++);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, delay);
}

export function send(msg: Record<string, unknown>): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

export function disconnect(): void {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    socket?.close();
    socket = null;
    $connectionState.set('disconnected');
}
