import {expect, test} from '../../framework/fixtures/senars-app';

test('cognitive features load', async ({page, testApi}) => {
    await expect(page.locator('graph-viewport')).toBeVisible();
    await expect(async () => {
        const state = await testApi.getConnectionState();
        expect(state).toBe('connected');
    }).toPass({timeout: 10000});
});
