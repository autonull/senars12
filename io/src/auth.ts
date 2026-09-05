export interface AuthManagerConfig {
  defaultMode?: 'open' | 'auth';
}

export class AuthManager {
  private readonly secrets = new Map<string, string>();
  private readonly authenticated = new Map<string, Set<string>>();

  constructor(config: AuthManagerConfig = {}) {
    // config stored for future use (defaultMode)
    void config;
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
    let bound = this.authenticated.get(connectionId);
    if (!bound) {
      bound = new Set();
      this.authenticated.set(connectionId, bound);
    }
    bound.add(senderId);
  }

  isBound(connectionId: string, senderId: string): boolean {
    return this.authenticated.get(connectionId)?.has(senderId) ?? false;
  }

  unbindUser(connectionId: string, senderId: string): void {
    this.authenticated.get(connectionId)?.delete(senderId);
  }

  clear(): void {
    this.secrets.clear();
    this.authenticated.clear();
  }
}
