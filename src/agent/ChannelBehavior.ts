export type ChannelType = 'irc' | 'ws' | 'http' | 'cli' | 'pipe';
export type ResponseMode = 'conversational' | 'narsese' | 'hybrid';

export interface ChannelBehaviorConfig {
maxResponseLength: number;
perUserContext: boolean;
showReasoning: boolean;
responseMode: ResponseMode;
}

export const CHANNEL_DEFAULTS: Record<ChannelType, ChannelBehaviorConfig> = {
irc: {maxResponseLength: 400, perUserContext: true, showReasoning: false, responseMode: 'conversational'},
ws: {maxResponseLength: 4000, perUserContext: true, showReasoning: false, responseMode: 'hybrid'},
http: {maxResponseLength: 8000, perUserContext: true, showReasoning: true, responseMode: 'hybrid'},
cli: {maxResponseLength: 8000, perUserContext: true, showReasoning: true, responseMode: 'hybrid'},
pipe: {maxResponseLength: 8000, perUserContext: true, showReasoning: true, responseMode: 'hybrid'},
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
