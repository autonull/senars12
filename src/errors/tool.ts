import { codedError } from './senars-error';

export const ToolError = codedError('ToolError', 'TOOL_ERROR');
export type ToolError = InstanceType<typeof ToolError>;
