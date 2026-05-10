export interface NlHandlerDeps {
    send: (channel: string, user: string, text: string) => void;
}

export function createNlHandler(_deps: NlHandlerDeps) {
    return (channel: string, user: string): void => {
        _deps.send(channel, user, 'Use (term). for beliefs or (term)? for questions');
    };
}