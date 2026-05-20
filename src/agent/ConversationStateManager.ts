import type {BotConfig} from './BotContext.js';
import {ConversationState} from './ConversationState.js';
import {IdentityResolver} from './IdentityResolver.js';

export class ConversationStateManager {
  private states = new Map<string, ConversationState>();
  private identityResolver: IdentityResolver;

  constructor(private readonly config: BotConfig, identityResolver?: IdentityResolver) {
    this.identityResolver = identityResolver || new IdentityResolver();
  }

  getOrCreate(
    sender: string,
    metadata?: { hostmask?: string; authId?: string; nick?: string; username?: string }
  ): ConversationState {
    const canonicalId = this.identityResolver.resolveIdentity(sender, metadata);
    if (!this.states.has(canonicalId)) {
      this.states.set(canonicalId, new ConversationState(this.config));
    }
    return this.states.get(canonicalId)!;
  }

  getByCanonicalId(canonicalId: string): ConversationState | undefined {
    return this.states.get(canonicalId);
  }

  get(sender: string): ConversationState | undefined {
    const canonicalId = this.identityResolver.getCanonicalId(sender);
    if (canonicalId) {
      return this.states.get(canonicalId);
    }
    return this.states.get(sender);
  }

  remove(sender: string): void {
    const canonicalId = this.identityResolver.getCanonicalId(sender);
    if (canonicalId) {
      this.states.delete(canonicalId);
    } else {
      this.states.delete(sender);
    }
  }

  getAll(): ReadonlyMap<string, ConversationState> {
    return this.states;
  }

  bindIdentity(canonicalId: string, alias: string): void {
    this.identityResolver.bindIdentity(canonicalId, alias);
  }

  getIdentities(canonicalId: string): string[] {
    return this.identityResolver.getIdentities(canonicalId);
  }

  getIdentityResolver(): IdentityResolver {
    return this.identityResolver;
  }

  getStats(): {
    totalIdentities: number;
    totalAliases: number;
    avgAliasesPerIdentity: number;
  } {
    return this.identityResolver.getStats();
  }
}
