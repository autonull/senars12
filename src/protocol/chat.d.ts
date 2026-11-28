import { z } from 'zod';
export declare const ChatMessage: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<{
        agent: "agent";
        system: "system";
        user: "user";
    }>;
    content: z.ZodString;
    html: z.ZodOptional<z.ZodString>;
    mode: z.ZodOptional<z.ZodString>;
    contexts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    timestamp: z.ZodNumber;
    term: z.ZodOptional<z.ZodString>;
    truth: z.ZodOptional<z.ZodObject<{
        frequency: z.ZodNumber;
        confidence: z.ZodNumber;
    }, z.core.$strip>>;
    punctuation: z.ZodOptional<z.ZodEnum<{
        "!": "!";
        ".": ".";
        ";": ";";
        "?": "?";
    }>>;
    parentId: z.ZodNullable<z.ZodString>;
    threadRootId: z.ZodString;
    supports: z.ZodArray<z.ZodString>;
    contradicts: z.ZodArray<z.ZodString>;
    derivesFrom: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type ChatMessage = z.infer<typeof ChatMessage>;
export declare const ChatUserMsg: z.ZodObject<{
    content: z.ZodString;
    mode: z.ZodOptional<z.ZodString>;
    contexts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    type: z.ZodLiteral<"chat.user">;
}, z.core.$strip>;
export declare const ChatAgentStream: z.ZodObject<{
    delta: z.ZodString;
    type: z.ZodLiteral<"chat.agent.stream">;
}, z.core.$strip>;
export declare const ChatAgentComplete: z.ZodObject<{
    content: z.ZodString;
    html: z.ZodOptional<z.ZodString>;
    messageId: z.ZodString;
    type: z.ZodLiteral<"chat.agent.complete">;
}, z.core.$strip>;
export declare const LMStatusRequest: z.ZodObject<{
    type: z.ZodLiteral<"lm.status.request">;
}, z.core.$strip>;
export declare const LMSwitchMsg: z.ZodObject<{
    provider: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"lm.switch">;
}, z.core.$strip>;
export declare const LMStatusMsg: z.ZodObject<{
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    type: z.ZodLiteral<"lm.status">;
}, z.core.$strip>;
//# sourceMappingURL=chat.d.ts.map