import {request, test as base} from '@playwright/test';
import {PerfMonitor} from '../utils/perf';
import {TestApiClient} from '../utils/test-api';
import {TestControl} from '../utils/test-control';
import {ErrorMonitor} from './error-monitor';

type SenarsFixtures = {
    testControl: TestControl;
    testApi: TestApiClient;
    errorMonitor: ErrorMonitor;
    perfMonitor: PerfMonitor;
};

export const test = base.extend<SenarsFixtures>({
    testControl: async ({}, use) => {
        const context = await request.newContext();
        const control = new TestControl(context);
        await control.reset();
        await use(control);
        await context.dispose();
    },

    testApi: async ({page}, use) => {
        await page.goto('/');
        const client = new TestApiClient(page);
        await client.ensureReady();
        await use(client);
    },

    errorMonitor: async ({page}, use) => {
        const monitor = new ErrorMonitor(page);
        monitor.start();
        await use(monitor);
        await monitor.assertNoErrors();
    },

    perfMonitor: async ({page}, use) => {
        const monitor = new PerfMonitor(page);
        await monitor.start();
        await use(monitor);
        await monitor.assertWithinBudget();
    },
});

export {expect} from '@playwright/test';
