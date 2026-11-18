import { codedError } from './senars-error.js';

export const TransportError = codedError('TransportError', 'TRANSPORT_ERROR');
export type TransportError = InstanceType<typeof TransportError>;

export const ConnectionError = codedError('ConnectionError', 'CONNECTION_ERROR');
export type ConnectionError = InstanceType<typeof ConnectionError>;
