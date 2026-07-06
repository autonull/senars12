import {Capability, CapabilityManager, CapabilityTypes} from '@senars/core/src/util/CapabilityManager';

describe('CapabilityManager', () => {
    describe('Capability', () => {
        test('construction', () => {
            const cap = new Capability(CapabilityTypes.FILE_SYSTEM_READ, {
                description: 'desc', scope: 'restricted', permissions: ['p1']
            });
            expect(cap).toMatchObject({
                type: CapabilityTypes.FILE_SYSTEM_READ,
                description: 'desc', scope: 'restricted', permissions: ['p1'],
                requiresApproval: false
            });
        });

        test('validation', () => {
            expect(new Capability(CapabilityTypes.FILE_SYSTEM_READ).validate().valid).toBe(true);

            const sys = new Capability(CapabilityTypes.SYSTEM_CONFIGURATION);
            expect(sys.validate().valid).toBe(false); // needs approval

            const bad = new Capability(CapabilityTypes.FILE_SYSTEM_READ, {resourceLimit: -1});
            expect(bad.validate().valid).toBe(false);
        });
    });

    describe('Manager', () => {
        let mgr;
        beforeEach(() => {
            mgr = new CapabilityManager();
        });

        test('registration', async () => {
            const cap = new Capability(CapabilityTypes.FILE_SYSTEM_READ);
            await expect(mgr.registerCapability('c1', cap)).resolves.toBe(true);
            expect(mgr.capabilities.get('c1')).toBe(cap);

            await expect(mgr.registerCapability('c1', cap)).rejects.toThrow('already exists');

            const invalid = new Capability(CapabilityTypes.SYSTEM_CONFIGURATION);
            await expect(mgr.registerCapability('c2', invalid)).rejects.toThrow('validation failed');
        });

        test('granting & checking', async () => {
            const [c1, c2] = [
                new Capability(CapabilityTypes.FILE_SYSTEM_READ),
                new Capability(CapabilityTypes.NETWORK_ACCESS)
            ];
            await mgr.registerCapability('c1', c1);
            await mgr.registerCapability('c2', c2);

            await expect(mgr.grantCapabilities('tool1', ['c1', 'c2'], {approved: true}))
                .resolves.toMatchObject({success: true, totalGranted: 2});

            expect(await mgr.hasCapability('tool1', 'c1')).toBe(true);
            expect(await mgr.hasAllCapabilities('tool1', ['c1', 'c2'])).toBe(true);
            expect(await mgr.getToolCapabilities('tool1')).toHaveLength(2);
            expect(await mgr.getToolsWithCapability('c1')).toContain('tool1');
        });

        test('grant failures', async () => {
            await expect(mgr.grantCapabilities('tool1', ['missing'], {approved: true}))
                .rejects.toThrow('does not exist');

            const sensitive = new Capability(CapabilityTypes.COMMAND_EXECUTION, {requiresApproval: true});
            await mgr.registerCapability('cmd', sensitive);

            await expect(mgr.grantCapabilities('tool1', ['cmd'])) // no approval
                .rejects.toThrow('requires explicit approval');
        });

        test('revocation', async () => {
            await mgr.registerCapability('c1', new Capability(CapabilityTypes.FILE_SYSTEM_READ));
            await mgr.grantCapabilities('tool1', ['c1'], {approved: true});

            await expect(mgr.revokeCapabilities('tool1', ['c1']))
                .resolves.toMatchObject({revoked: ['c1']});

            expect(await mgr.hasCapability('tool1', 'c1')).toBe(false);
        });

        test('stats', async () => {
            await mgr.registerCapability('c1', new Capability(CapabilityTypes.FILE_SYSTEM_READ));
            await mgr.grantCapabilities('t1', ['c1'], {approved: true});

            const stats = mgr.getUsageStats();
            expect(stats).toMatchObject({
                totalCapabilities: 1, totalGrants: 1, toolsWithGrants: 1
            });
        });

        test('policy rules', async () => {
            await mgr.registerCapability('c1', new Capability(CapabilityTypes.FILE_SYSTEM_READ));
            await mgr.addPolicyRule('deny-t1', {
                type: 'deny', tools: ['t1'], capabilities: ['c1']
            });

            await expect(mgr.grantCapabilities('t1', ['c1'], {approved: true}))
                .rejects.toThrow('Policy violation');
        });

        test('manifests', async () => {
            await mgr.registerCapability('c1', new Capability(CapabilityTypes.FILE_SYSTEM_READ));

            const m = {id: 'm1', name: 'M1', requiredCapabilities: ['c1'], optionalCapabilities: []};
            expect(mgr.createSecurityManifest(m)).toMatchObject({id: 'm1', requiredCapabilities: ['c1']});

            expect(() => mgr.createSecurityManifest({...m, requiredCapabilities: ['unknown']}))
                .toThrow('Unknown capability');
        });
    });

    test('Default Manager', async () => {
        const dm = await CapabilityManager.createDefaultManager();
        expect(dm.capabilities.has('file-system-read')).toBe(true);
        expect(dm.capabilities.has('network-access')).toBe(true);
    });
});
