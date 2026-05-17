export type ChannelType = 'irc' | 'ws' | 'http' | 'cli';
export type ResponseMode = 'conversational' | 'narsese' | 'hybrid';

const CHANNEL_DEFAULTS: Record<ChannelType, {maxResponseLength: number; perUserContext: boolean; showReasoning: boolean; responseMode: ResponseMode}> = {
    irc: {maxResponseLength: 400, perUserContext: true, showReasoning: false, responseMode: 'conversational'},
    ws: {maxResponseLength: 4000, perUserContext: true, showReasoning: false, responseMode: 'hybrid'},
    http: {maxResponseLength: 8000, perUserContext: true, showReasoning: true, responseMode: 'hybrid'},
    cli: {maxResponseLength: 8000, perUserContext: true, showReasoning: true, responseMode: 'hybrid'},
};

export class ChannelBehavior {
    maxResponseLength: number;
    perUserContext: boolean;
    showReasoning: boolean;
    responseMode: ResponseMode;

    constructor(channelType: ChannelType = 'irc') {
        const defaults = CHANNEL_DEFAULTS[channelType];
        this.maxResponseLength = defaults.maxResponseLength;
        this.perUserContext = defaults.perUserContext;
        this.showReasoning = defaults.showReasoning;
        this.responseMode = defaults.responseMode;
    }
}
