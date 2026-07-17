export const LLM_COMMANDS = [
    'send',
    'remember',
    'query',
    'episodes',
    'read-file',
    'write-file',
    'append-file',
    'search',
    'shell',
    'metta',
    'pin',
    'tavily-search',
    'technical-analysis',
];
export class MettaCommandParser {
    parse(llmOutput) {
        const normalized = llmOutput.replace(/_quote_/g, '"').replace(/_newline_/g, '\n');
        const lines = normalized
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => Boolean(l));
        const merged = this.#mergeSendContinuations(lines);
        return merged
            .map((line) => this.#parseLine(line))
            .filter((c) => c !== null);
    }
    #mergeSendContinuations(lines) {
        const merged = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines.at(i);
            const cmd = this.#getCommandName(line);
            if (cmd !== 'send') {
                merged.push(line);
                i++;
                continue;
            }
            const sendWrapped = line.startsWith('(');
            const head = sendWrapped ? line.slice(1).trimStart() : line;
            const parts = head.split(/\s+/, 2);
            let text = parts.at(1)?.trim() ?? '';
            if (text.startsWith('"')) {
                const decoded = this.#decodeQuoted(text);
                if (decoded !== null)
                    text = decoded;
            }
            i++;
            const continuations = [];
            while (i < lines.length && !this.#isKnownCommand(lines.at(i))) {
                let cont = lines.at(i).trim();
                if (sendWrapped && cont.endsWith(')')) {
                    cont = cont.slice(0, -1).trimEnd();
                    continuations.push(cont);
                    i++;
                    break;
                }
                continuations.push(cont);
                i++;
            }
            if (continuations.length > 0) {
                text = text ? `${text}\n${continuations.join('\n')}` : continuations.join('\n');
            }
            merged.push(`send ${JSON.stringify(text)}`);
        }
        return merged;
    }
    #parseLine(line) {
        let stripped = line;
        if (stripped.startsWith('(') && stripped.endsWith(')')) {
            stripped = stripped.slice(1, -1).trim();
        }
        if (stripped.startsWith('-')) {
            stripped = `pin ${stripped.slice(1)}`;
        }
        else if (stripped.startsWith('(-')) {
            stripped = `(pin -${stripped.slice(2)}`;
        }
        const parts = stripped.split(/\s+/, 2);
        const cmd = parts.at(0);
        const rest = parts.at(1)?.trim() ?? '';
        if (!cmd || !LLM_COMMANDS.includes(cmd))
            return null;
        const llmCmd = cmd;
        if (llmCmd === 'write-file' || llmCmd === 'append-file') {
            let filename = '';
            let content = '';
            if (rest.startsWith('"')) {
                const end = this.#findClosingQuote(rest, 0);
                filename = rest.slice(0, end + 1);
                content = rest.slice(end + 1).trim();
            }
            else {
                const split = rest.split(/\s+/, 2);
                filename = `"${split.at(0)?.replace(/"/g, '\\"') ?? ''}"`;
                content = split.at(1) ?? '';
            }
            if (content.startsWith('"') && content.endsWith('"')) {
                return { command: llmCmd, args: [filename, content], raw: line };
            }
            content = content.replace(/"/g, '\\"');
            return { command: llmCmd, args: [filename, `"${content}"`], raw: line };
        }
        let arg = rest;
        if (!arg.startsWith('"')) {
            arg = `"${arg.replace(/"/g, '\\"')}"`;
        }
        return { command: llmCmd, args: [arg], raw: line };
    }
    #getCommandName(line) {
        let normalized = line.trim();
        while (normalized.startsWith('('))
            normalized = normalized.slice(1).trimStart();
        while (normalized.endsWith(')'))
            normalized = normalized.slice(0, -1).trimEnd();
        return normalized.split(/\s+/)[0] ?? '';
    }
    #isKnownCommand(line) {
        return LLM_COMMANDS.includes(this.#getCommandName(line));
    }
    #decodeQuoted(text) {
        try {
            return JSON.parse(text);
        }
        catch {
            return null;
        }
    }
    #findClosingQuote(str, start) {
        let escaped = false;
        for (let i = start + 1; i < str.length; i++) {
            const ch = str[i];
            if (!ch)
                break;
            if (ch === '"' && !escaped)
                return i;
            escaped = ch === '\\' && !escaped;
        }
        return str.length - 1;
    }
}
//# sourceMappingURL=MettaCommandParser.js.map