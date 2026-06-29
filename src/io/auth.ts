export interface AuthManagerConfig {
    defaultMode?: 'open' | 'auth';
}

export class AuthManager {
    private readonly secrets: Map<string, string> = new Map();
    private readonly authenticated: Map<string, Set<string>> = new Map();
    private readonly config: Required<AuthManagerConfig>;

    constructor(config: AuthManagerConfig = {}) {
        this.config = {
            defaultMode: config.defaultMode ?? 'open',
        };
    }

    setSecret(connectionId: string, secret: string): void {
        this.secrets.set(connectionId, secret);
    }

    removeSecret(connectionId: string): void {
        this.secrets.delete(connectionId);
    }

    checkAuth(
        connectionId: string,
        senderId: string,
        message: string
    ): 'allow' | 'ignore' | 'auth_bound' {
        const secret = this.secrets.get(connectionId);
        if (!secret) return 'allow';

        const bound = this.authenticated.get(connectionId);
        if (bound?.has(senderId)) return 'allow';

        if (message.trim() === `.auth ${secret}`) return 'auth_bound';

        return 'ignore';
    }

    bindUser(connectionId: string, senderId: string): void {
        if (!this.authenticated.has(connectionId)) {
            this.authenticated.set(connectionId, new Set());
        }
        this.authenticated.get(connectionId)!.add(senderId);
    }

    isBound(connectionId: string, senderId: string): boolean {
        return this.authenticated.get(connectionId)?.has(senderId) ?? false;
    }

    unbindUser(connectionId: string, senderId: string): void {
        this.authenticated.get(connectionId)?.delete(senderId);
    }

    getMode(connectionId: string): 'open' | 'auth' {
        return this.secrets.has(connectionId) ? 'auth' : 'open';
    }

    hasSecret(connectionId: string): boolean {
        return this.secrets.has(connectionId);
    }

    clearConnection(connectionId: string): void {
        this.secrets.delete(connectionId);
        this.authenticated.delete(connectionId);
    }
}
