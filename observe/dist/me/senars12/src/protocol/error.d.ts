/**
 * Server error frame.
 *
 * The boundary used to reject a malformed client message by logging to stdout
 * and staying silent, so a control could fail without the UI ever knowing. This
 * is the one typed reply every rejected message gets.
 */
import { z } from 'zod';
export declare const ServerErrorCode: z.ZodEnum<{
    internal: "internal";
    invalid_message: "invalid_message";
    not_available: "not_available";
    unsupported: "unsupported";
}>;
export type ServerErrorCode = z.infer<typeof ServerErrorCode>;
export declare const ServerError: z.ZodObject<{
    code: z.ZodEnum<{
        internal: "internal";
        invalid_message: "invalid_message";
        not_available: "not_available";
        unsupported: "unsupported";
    }>;
    message: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    type: z.ZodLiteral<"server.error">;
}, z.core.$strip>;
export type ServerError = z.infer<typeof ServerError>;
//# sourceMappingURL=error.d.ts.map