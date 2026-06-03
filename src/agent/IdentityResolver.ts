export interface IdentityBinding {
  canonicalId: string;
  aliases: Set<string>;
  metadata: {
    hostmask?: string;
    authId?: string;
    nick?: string;
    username?: string;
    lastSeen: number;
  };
}

export interface IdentitySnapshot {
  canonicalId: string;
  allAliases: string[];
  metadata: IdentityBinding['metadata'];
}

export class IdentityResolver {
  private readonly identityMap = new Map<string, IdentityBinding>();
  private readonly aliasIndex = new Map<string, string>();

  resolveIdentity(
    sender: string,
    metadata?: { hostmask?: string; authId?: string; nick?: string; username?: string }
  ): string {
    const existingCanonical = this.aliasIndex.get(sender);
    if (existingCanonical) {
      const binding = this.identityMap.get(existingCanonical);
      if (binding) {
        binding.metadata.lastSeen = Date.now();
        if (metadata?.hostmask) binding.metadata.hostmask = metadata.hostmask;
        if (metadata?.authId) binding.metadata.authId = metadata.authId;
        if (metadata?.nick) binding.metadata.nick = metadata.nick;
        if (metadata?.username) binding.metadata.username = metadata.username;
        return existingCanonical;
      }
    }

    if (metadata?.hostmask) {
      const existingByHostmask = this.findByIdentityMetadata('hostmask', metadata.hostmask);
      if (existingByHostmask) {
        this.bindIdentity(existingByHostmask, sender);
        const binding = this.identityMap.get(existingByHostmask);
        if (binding) {
          if (metadata.authId) binding.metadata.authId = metadata.authId;
          if (metadata.nick) binding.metadata.nick = metadata.nick;
          if (metadata.username) binding.metadata.username = metadata.username;
          binding.metadata.lastSeen = Date.now();
        }
        return existingByHostmask;
      }
    }

    if (metadata?.authId) {
      const existingByAuth = this.findByIdentityMetadata('authId', metadata.authId);
      if (existingByAuth) {
        this.bindIdentity(existingByAuth, sender);
        const binding = this.identityMap.get(existingByAuth);
        if (binding) {
          if (metadata.hostmask) binding.metadata.hostmask = metadata.hostmask;
          if (metadata.nick) binding.metadata.nick = metadata.nick;
          if (metadata.username) binding.metadata.username = metadata.username;
          binding.metadata.lastSeen = Date.now();
        }
        return existingByAuth;
      }
    }

    const canonicalId = metadata?.authId || sender;
    this.identityMap.set(canonicalId, {
      canonicalId,
      aliases: new Set([sender]),
      metadata: {
        hostmask: metadata?.hostmask,
        authId: metadata?.authId,
        nick: metadata?.nick,
        username: metadata?.username,
        lastSeen: Date.now(),
      },
    });
    this.aliasIndex.set(sender, canonicalId);

    return canonicalId;
  }

  bindIdentity(canonicalId: string, alias: string): void {
    const binding = this.identityMap.get(canonicalId);
    if (binding) {
      binding.aliases.add(alias);
      this.aliasIndex.set(alias, canonicalId);
    } else {
      this.identityMap.set(canonicalId, {
        canonicalId,
        aliases: new Set([alias]),
        metadata: { lastSeen: Date.now() },
      });
      this.aliasIndex.set(alias, canonicalId);
    }
  }

  unbindIdentity(canonicalId: string, alias: string): void {
    const binding = this.identityMap.get(canonicalId);
    if (binding) {
      binding.aliases.delete(alias);
      this.aliasIndex.delete(alias);
      if (binding.aliases.size === 0) {
        this.identityMap.delete(canonicalId);
      }
    }
  }

  getIdentities(canonicalId: string): string[] {
    const binding = this.identityMap.get(canonicalId);
    if (!binding) return [];
    return Array.from(binding.aliases);
  }

  getCanonicalId(sender: string): string | undefined {
    return this.aliasIndex.get(sender);
  }

  getAllIdentities(): IdentitySnapshot[] {
    return Array.from(this.identityMap.values()).map((binding) => ({
      canonicalId: binding.canonicalId,
      allAliases: Array.from(binding.aliases),
      metadata: binding.metadata,
    }));
  }

  getIdentityMetadata(canonicalId: string): IdentityBinding['metadata'] | undefined {
    return this.identityMap.get(canonicalId)?.metadata;
  }

  updateIdentityMetadata(
    canonicalId: string,
    metadata: Partial<IdentityBinding['metadata']>
  ): void {
    const binding = this.identityMap.get(canonicalId);
    if (binding) {
      if (metadata.hostmask) binding.metadata.hostmask = metadata.hostmask;
      if (metadata.authId) binding.metadata.authId = metadata.authId;
      if (metadata.nick) binding.metadata.nick = metadata.nick;
      if (metadata.username) binding.metadata.username = metadata.username;
      if (metadata.lastSeen) binding.metadata.lastSeen = metadata.lastSeen;
    }
  }

  findByIdentityMetadata(
    key: keyof IdentityBinding['metadata'],
    value: string
  ): string | undefined {
    for (const [canonicalId, binding] of this.identityMap) {
      if (binding.metadata[key] === value) {
        return canonicalId;
      }
    }
    return undefined;
  }

  mergeIdentities(canonicalId1: string, canonicalId2: string): string {
    if (canonicalId1 === canonicalId2) return canonicalId1;

    const binding1 = this.identityMap.get(canonicalId1);
    const binding2 = this.identityMap.get(canonicalId2);

    if (!binding1 || !binding2) {
      return canonicalId1 || canonicalId2;
    }

    const merged: IdentityBinding = {
      canonicalId: canonicalId1,
      aliases: new Set([...binding1.aliases, ...binding2.aliases]),
      metadata: {
        hostmask: binding1.metadata.hostmask || binding2.metadata.hostmask,
        authId: binding1.metadata.authId || binding2.metadata.authId,
        nick: binding1.metadata.nick || binding2.metadata.nick,
        username: binding1.metadata.username || binding2.metadata.username,
        lastSeen: Math.max(binding1.metadata.lastSeen, binding2.metadata.lastSeen),
      },
    };

    for (const alias of binding2.aliases) {
      this.aliasIndex.set(alias, canonicalId1);
    }

    this.identityMap.set(canonicalId1, merged);
    this.identityMap.delete(canonicalId2);

    return canonicalId1;
  }

  getStats(): {
    totalIdentities: number;
    totalAliases: number;
    avgAliasesPerIdentity: number;
  } {
    const totalAliases = Array.from(this.identityMap.values()).reduce(
      (sum, b) => sum + b.aliases.size,
      0
    );
    return {
      totalIdentities: this.identityMap.size,
      totalAliases,
      avgAliasesPerIdentity: this.identityMap.size > 0 ? totalAliases / this.identityMap.size : 0,
    };
  }

  clear(): void {
    this.identityMap.clear();
    this.aliasIndex.clear();
  }
}
