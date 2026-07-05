/**
 * CommandRegistry - Extensible command system for SeNARS.
 * Shared between CLI (TUI) and Web UI.
 */
export class CommandRegistry {
    constructor(options = {}) {
        this.commands = new Map();
        this.logger = options.logger || console;
        this._initializeDefaultCommands();
    }

    /**
     * Initialize default commands
     */
    _initializeDefaultCommands() {
        this.registerCommand('/help', ctx => this._showHelp(ctx));
        this.registerCommand('/state', ctx => this._showState(ctx));
        this.registerCommand('/clear', ctx => this._clearLogs(ctx));
    }

    /**
     * Register a new command
     */
    registerCommand(command, handler, metadata = {}) {
        if (typeof handler !== 'function') {
            throw new Error('Command handler must be a function');
        }
        this.commands.set(command.toLowerCase(), {handler, metadata});
        return this;
    }

    /**
     * Unregister a command
     */
    unregisterCommand(command) {
        return this.commands.delete(command.toLowerCase());
    }

    /**
     * Execute a command
     */
    executeCommand(commandString, context) {
        const parts = commandString.split(' ');
        const cmdName = parts[0].toLowerCase();
        const args = parts.slice(1);

        const cmdEntry = this.commands.get(cmdName);

        if (cmdEntry) {
            return cmdEntry.handler({...context, args});
        } else {
            this.logger.warn(`Unknown command: ${cmdName}. Type /help for available commands.`);
            return false;
        }
    }

    /**
     * Get list of available commands
     */
    getCommandList() {
        return Array.from(this.commands.keys());
    }

    /**
     * Default command handlers
     */
    _showHelp(context) {
        const helpMessages = [
            'Available commands:',
            ...Array.from(this.commands.entries()).map(([name, entry]) =>
                `  ${name}${entry.metadata.description ? ` - ${entry.metadata.description}` : ''}`
            )
        ];

        helpMessages.forEach(msg => this.logger.info(msg));
        return true;
    }

    _showState(context) {
        this.logger.info(`System State: ${context.systemStatus || 'Unknown'}`);
        return true;
    }

    _clearLogs(context) {
        if (this.logger.clear) {
            this.logger.clear();
        } else if (context.logger?.clearLogs) {
            context.logger.clearLogs();
        }
        return true;
    }
}
