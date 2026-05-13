/**
 * Predefined domain knowledge for quick loading
 */

export const DOMAINS: Record<string, string[]> = {
    biology: [
        '<cell --> [unit]>.',
        '<organelle --> [component]>.',
        '<DNA --> [molecule]>.',
        '<protein --> [molecule]>.',
        '<metabolism --> [process]>.',
        '<photosynthesis --> [process]>.',
    ],
    physics: [
        '<force --> [interaction]>.',
        '<mass --> [property]>.',
        '<energy --> [property]>.',
        '<velocity --> [rate]>.',
        '<gravity --> [force]>.',
        '<electromagnetic --> [force]>.',
    ],
    mathematics: [
        '<number --> [quantity]>.',
        '<set --> [collection]>.',
        '<function --> [mapping]>.',
        '<proof --> [reasoning]>.',
        '<geometry --> [mathematics]>.',
        '<algebra --> [mathematics]>.',
    ],
    programming: [
        '<function --> [code]>.',
        '<variable --> [storage]>.',
        '<algorithm --> [procedure]>.',
        '<compiler --> [tool]>.',
        '<recursive --> [algorithm]>.',
        '<iteration --> [algorithm]>.',
    ],
    finance: [
        '<money --> [value]>.',
        '<investment --> [allocation]>.',
        '<risk --> [uncertainty]>.',
        '<profit --> [gain]>.',
        '<market --> [system]>.',
        '<portfolio --> [collection]>.',
    ],
};

export const DOMAIN_LIST = Object.keys(DOMAINS).join(', ');

export function getDomain(name: string): string[] | undefined {
    return DOMAINS[name.toLowerCase()];
}