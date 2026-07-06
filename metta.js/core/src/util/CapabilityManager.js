export const CapabilityTypes = {
    FILE_SYSTEM_READ: 'file-system-read',
    FILE_SYSTEM_WRITE: 'file-system-write',
    NETWORK_ACCESS: 'network-access',
    COMMAND_EXECUTION: 'command-execution',
    PROCESS_MANAGEMENT: 'process-management',
    USER_MANAGEMENT: 'user-management',
    SYSTEM_CONFIGURATION: 'system-configuration',
    DATABASE_ACCESS: 'database-access',
    ENCRYPTION: 'encryption',
    CRYPTOGRAPHY: 'cryptography',
    EXTERNAL_API_ACCESS: 'external-api-access',
    WEB_REQUESTS: 'web-requests',
    RESOURCE_LIMITS: 'resource-limits',
    MEMORY_ACCESS: 'memory-access',
    CPU_INTENSIVE: 'cpu-intensive'
};

export class Capability {
    constructor(type, options = {}) {
        this.type = type;
        this.description = options.description || `Capability for ${type}`;
        this.resourceLimit = options.resourceLimit || null;
        this.scope = options.scope || 'default';
        this.permissions = options.permissions || [];
        this.requiresApproval = options.requiresApproval || false;
        this.createdAt = new Date().toISOString();
    }

    validate() {
        const result = {valid: true, errors: []};

        if ([CapabilityTypes.PROCESS_MANAGEMENT,
                CapabilityTypes.USER_MANAGEMENT,
                CapabilityTypes.SYSTEM_CONFIGURATION].includes(this.type)
            && !this.requiresApproval) {
            result.valid = false;
            result.errors.push(`Capability ${this.type} requires explicit approval`);
        }

        if (this.resourceLimit !== null && this.resourceLimit <= 0) {
            result.valid = false;
            result.errors.push(`Invalid resource limit: ${this.resourceLimit}`);
        }

        return result;
    }
}

export class CapabilityManager {
    constructor() {
        this.capabilities = new Map();
        this.grants = new Map();
        this.policyRules = new Map();
        this.auditLog = [];
    }

    static async createDefaultManager() {
        const manager = new CapabilityManager();
        const defaultCapabilities = [
            {
                id: 'file-system-read',
                type: CapabilityTypes.FILE_SYSTEM_READ,
                description: 'Read access to file system in restricted directories',
                scope: 'local',
                permissions: ['read-files', 'read-directories']
            },
            {
                id: 'file-system-write',
                type: CapabilityTypes.FILE_SYSTEM_WRITE,
                description: 'Write access to file system in restricted directories',
                scope: 'local',
                permissions: ['write-files', 'create-directories'],
                requiresApproval: true
            },
            {
                id: 'network-access',
                type: CapabilityTypes.NETWORK_ACCESS,
                description: 'Network access for HTTP requests',
                scope: 'network',
                permissions: ['http-requests', 'https-requests']
            },
            {
                id: 'command-execution',
                type: CapabilityTypes.COMMAND_EXECUTION,
                description: 'Execute predefined safe system commands',
                scope: 'system',
                permissions: ['execute-commands'],
                requiresApproval: true
            },
            {
                id: 'external-api-access',
                type: CapabilityTypes.EXTERNAL_API_ACCESS,
                description: 'Access to external APIs',
                scope: 'network',
                permissions: ['api-calls'],
                requiresApproval: true
            }
        ];

        for (const cap of defaultCapabilities) {
            await manager.registerCapability(cap.id, new Capability(cap.type, cap));
        }

        return manager;
    }

    async registerCapability(id, capability) {
        if (!id || !capability) {
            throw new Error('Both id and capability are required for registration');
        }

        if (this.capabilities.has(id)) {
            throw new Error(`Capability with ID "${id}" already exists`);
        }

        const validation = capability.validate();
        if (!validation.valid) {
            throw new Error(`Capability validation failed: ${validation.errors.join(', ')}`);
        }

        this.capabilities.set(id, capability);
        this._logAudit('capability-registered', {
            capabilityId: id,
            capabilityType: capability.type,
            description: capability.description
        });

        return true;
    }

    async grantCapabilities(toolId, capabilityIds, options = {}) {
        if (!toolId || !Array.isArray(capabilityIds) || !capabilityIds.length) {
            throw new Error('Tool ID and at least one capability ID are required');
        }

        // Validate all capabilities exist
        for (const capId of capabilityIds) {
            if (!this.capabilities.has(capId)) {
                throw new Error(`Capability ID "${capId}" does not exist`);
            }
        }

        // Check approval requirements and policies
        for (const capId of capabilityIds) {
            const capability = this.capabilities.get(capId);
            if (capability.requiresApproval && !options.approved) {
                throw new Error(`Capability "${capId}" requires explicit approval`);
            }

            const policyCheck = this._checkPolicyRules(toolId, capId, options);
            if (!policyCheck.allowed) {
                throw new Error(`Policy violation: ${policyCheck.reason}`);
            }
        }

        // Initialize grants for tool if needed
        !this.grants.has(toolId) && this.grants.set(toolId, new Set());

        const toolGrants = this.grants.get(toolId);
        const granted = [], failed = [];

        // Process each capability
        for (const capId of capabilityIds) {
            if (toolGrants.has(capId)) {
                failed.push({id: capId, reason: 'Already granted'});
                continue;
            }

            toolGrants.add(capId);
            granted.push(capId);
            this._logAudit('capability-granted', {
                toolId,
                capabilityId: capId,
                grantedBy: options.grantedBy || 'system',
                expiresAt: options.expiresAt,
                conditions: options.conditions
            });
        }

        return {
            success: true,
            granted,
            failed,
            totalRequested: capabilityIds.length,
            totalGranted: granted.length
        };
    }

    async revokeCapabilities(toolId, capabilityIds) {
        if (!toolId || !Array.isArray(capabilityIds) || !capabilityIds.length) {
            throw new Error('Tool ID and at least one capability ID are required');
        }

        const toolGrants = this.grants.get(toolId);
        if (!toolGrants) {
            return {
                success: true,
                revoked: [],
                failed: capabilityIds.map(id => ({id, reason: 'No grants exist for tool'}))
            };
        }

        const revoked = [], failed = [];

        // Process each capability
        for (const capId of capabilityIds) {
            if (toolGrants.has(capId)) {
                toolGrants.delete(capId);
                revoked.push(capId);
                this._logAudit('capability-revoked', {toolId, capabilityId: capId});
            } else {
                failed.push({id: capId, reason: 'Not granted to tool'});
            }
        }

        // Clean up empty grants
        !toolGrants.size && this.grants.delete(toolId);

        return {
            success: true,
            revoked,
            failed,
            totalRequested: capabilityIds.length,
            totalRevoked: revoked.length
        };
    }

    async hasCapability(toolId, capabilityId) {
        const toolGrants = this.grants.get(toolId);
        return !!toolGrants?.has(capabilityId);
    }

    async hasAllCapabilities(toolId, capabilityIds) {
        if (!Array.isArray(capabilityIds) || !capabilityIds.length) {
            return true;
        }
        const toolGrants = this.grants.get(toolId);
        return !!toolGrants && capabilityIds.every(capId => toolGrants.has(capId));
    }

    async getToolCapabilities(toolId) {
        const toolGrants = this.grants.get(toolId);
        if (!toolGrants) {
            return [];
        }

        return Array.from(toolGrants).map(capId => {
            const capability = this.capabilities.get(capId);
            return {
                id: capId,
                type: capability?.type,
                description: capability?.description,
                scope: capability?.scope,
                permissions: capability?.permissions
            };
        });
    }

    async getToolsWithCapability(capabilityId) {
        const tools = [];
        for (const [toolId, toolGrants] of this.grants.entries()) {
            toolGrants.has(capabilityId) && tools.push(toolId);
        }
        return tools;
    }

    async addPolicyRule(ruleId, rule) {
        if (!ruleId || !rule) {
            throw new Error('Both ruleId and rule are required');
        }

        if (!rule.type || !['deny', 'allow', 'conditional'].includes(rule.type)) {
            throw new Error('Rule type must be one of: deny, allow, conditional');
        }

        if (!rule.tools || (!Array.isArray(rule.tools) && typeof rule.tools !== 'string')) {
            throw new Error('Rule must specify tools (array or string)');
        }

        if (!rule.capabilities || (!Array.isArray(rule.capabilities) && typeof rule.capabilities !== 'string')) {
            throw new Error('Rule must specify capabilities (array or string)');
        }

        this.policyRules.set(ruleId, rule);
        this._logAudit('policy-rule-added', {
            ruleId,
            ruleType: rule.type,
            tools: rule.tools,
            capabilities: rule.capabilities
        });

        return true;
    }

    _checkPolicyRules(toolId, capabilityId, grantOptions) {
        for (const [ruleId, rule] of this.policyRules.entries()) {
            const toolMatch = this._matchesPattern(toolId, rule.tools);
            const capMatch = this._matchesPattern(capabilityId, rule.capabilities);

            if (toolMatch && capMatch) {
                if (rule.condition && typeof rule.condition === 'function') {
                    try {
                        if (!rule.condition(toolId, capabilityId, grantOptions)) {
                            continue;
                        }
                    } catch (error) {
                        this._logAudit('policy-condition-error', {ruleId, error: error.message});
                        continue;
                    }
                }

                if (rule.type === 'deny') {
                    return {
                        allowed: false,
                        reason: rule.reason || `Policy rule ${ruleId} denies capability ${capabilityId} for tool ${toolId}`
                    };
                }
            }
        }

        return {allowed: true};
    }

    _matchesPattern(value, patterns) {
        if (typeof patterns === 'string') {
            patterns = [patterns];
        }

        for (const pattern of patterns) {
            if (pattern === '*' || pattern === value) {
                return true;
            }
            if (pattern.endsWith('*') && value.startsWith(pattern.slice(0, -1))) {
                return true;
            }
            if (pattern.startsWith('*') && value.endsWith(pattern.slice(1))) {
                return true;
            }
        }

        return false;
    }

    createSecurityManifest(manifest) {
        if (!manifest || !manifest.id || !manifest.name) {
            throw new Error('Manifest must include id and name');
        }

        const validated = {
            id: manifest.id,
            name: manifest.name,
            requiredCapabilities: manifest.requiredCapabilities || [],
            optionalCapabilities: manifest.optionalCapabilities || [],
            metadata: manifest.metadata || {},
            createdAt: new Date().toISOString()
        };

        const allCapabilities = [...validated.requiredCapabilities, ...validated.optionalCapabilities];
        for (const capId of allCapabilities) {
            if (!this.capabilities.has(capId)) {
                throw new Error(`Unknown capability in manifest: ${capId}`);
            }
        }

        return validated;
    }

    async requestCapabilitiesFromManifest(manifest, approvalContext = {}) {
        if (!manifest || !manifest.id) {
            throw new Error('Manifest must include an ID');
        }

        const allCapabilities = [...manifest.requiredCapabilities, ...manifest.optionalCapabilities];
        const capabilitiesToGrant = allCapabilities.filter(capId => {
            const capability = this.capabilities.get(capId);
            return !capability.requiresApproval || approvalContext.approvedCapabilities?.includes(capId);
        });

        return this.grantCapabilities(manifest.id, capabilitiesToGrant, {
            grantedBy: approvalContext.grantedBy || 'system',
            approved: true,
            conditions: approvalContext.conditions
        });
    }

    getUsageStats() {
        const stats = {
            totalCapabilities: this.capabilities.size,
            totalGrants: 0,
            toolsWithGrants: this.grants.size,
            capabilityUsage: new Map(),
            auditLogSize: this.auditLog.length
        };

        for (const [toolId, toolGrants] of this.grants.entries()) {
            stats.totalGrants += toolGrants.size;
            for (const capId of toolGrants) {
                const count = stats.capabilityUsage.get(capId) || 0;
                stats.capabilityUsage.set(capId, count + 1);
            }
        }

        return stats;
    }

    getAuditLog(filter = {}) {
        let events = [...this.auditLog];

        filter.eventType && (events = events.filter(event => event.type === filter.eventType));
        filter.toolId && (events = events.filter(event =>
            event.data.toolId === filter.toolId ||
            event.data.capabilityGrants?.some(g => g.toolId === filter.toolId)
        ));
        filter.since && (events = events.filter(event => event.timestamp >= filter.since));
        filter.limit && (events = events.slice(-filter.limit));

        return events;
    }

    _logAudit(eventType, data) {
        const event = {
            type: eventType,
            data,
            timestamp: new Date().toISOString()
        };

        this.auditLog.push(event);
        this.auditLog.length > 10000 && (this.auditLog = this.auditLog.slice(-5000));
    }

    hasCapabilityType(toolId, capabilityType) {
        const toolGrants = this.grants.get(toolId);
        if (!toolGrants) {
            return false;
        }

        for (const capId of toolGrants) {
            const capability = this.capabilities.get(capId);
            if (capability?.type === capabilityType) {
                return true;
            }
        }
        return false;
    }

    getCapabilityTypesForTool(toolId) {
        const toolGrants = this.grants.get(toolId);
        if (!toolGrants) {
            return [];
        }

        const types = new Set();
        for (const capId of toolGrants) {
            const capability = this.capabilities.get(capId);
            capability?.type && types.add(capability.type);
        }
        return Array.from(types);
    }
}