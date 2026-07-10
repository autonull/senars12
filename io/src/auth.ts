export class AuthManager {
  private secrets: Set<string> = new Set();

  addSecret(secret: string): void {
    this.secrets.add(secret);
  }

  removeSecret(secret: string): void {
    this.secrets.delete(secret);
  }

  validate(secret: string): boolean {
    if (this.secrets.size === 0) return true;
    return this.secrets.has(secret);
  }

  clear(): void {
    this.secrets.clear();
  }
}
