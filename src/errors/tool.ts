import { codedError } from './senars-error.js';

export const ToolError = codedError('ToolError', 'TOOL_ERROR');
export type ToolError = InstanceType<typeof ToolError>;
